/* global io, feathers, moment */
// Establish a Socket.io connection
let G_USER = null;
const socket = io();
// Initialize our Feathers client application through Socket.io
// with hooks and authentication.
const client = feathers();

client.configure(feathers.socketio(socket));
// Use localStorage to store our login token
client.configure(feathers.authentication());

//////////// Base HTML
// Login screen
const loginHTML = `<main class="login container">
  <div class="row">
    <div class="col-12 col-6-tablet push-3-tablet text-center heading">
      <h1 class="font-100">Welcome to feathers chatroom</h1>
    </div>
  </div>
  <div class="row">
    <div class="col-12 col-6-tablet push-3-tablet col-4-desktop push-4-desktop">
      <form class="form">
        <fieldset>
          <input class="block" type="email" name="email" placeholder="email">
        </fieldset>

        <fieldset>
          <input class="block" type="password" name="password" placeholder="password">
        </fieldset>

        <button type="button" id="login" class="button button-primary block signup">
          Log in
        </button>

        <button type="button" id="signup" class="button button-primary block signup">
          Sign up and log in
        </button>

        <!--
        <a class="button button-primary block" href="/oauth/github">
          Login with GitHub
        </a>
        -->
      </form>
    </div>
  </div>
</main>`;

// Chat base HTML (without user list and messages)
const chatHTML = `<main class="flex flex-column">
  <header class="title-bar flex flex-row flex-center">
    <div class="title-wrapper block center-element">
      <img class="logo" src="./未命名繪圖.png"
        alt="Feathers Logo">
      <span class="title">Chat</span>
    </div>
  </header>

  <div class="flex flex-row flex-1 clear">
    <aside class="sidebar col col-3 flex flex-column flex-space-between">
      <header class="flex flex-row flex-center">
        <h4 class="font-300 text-center">
          <span class="font-600 online-count">0</span> users
        </h4>
      </header>

      <ul class="flex flex-column flex-1 list-unstyled user-list"></ul>
      <footer class="flex flex-row flex-center">
        <a href="#" id="logout" class="button button-primary">
          Sign Out
        </a>
      </footer>
    </aside>

    <div class="flex flex-column col col-9">
      <main class="chat flex flex-column flex-1 clear"></main>
      <p style="margin:0 15px 0 0;text-align:right;background:#f8f8f8">
        <input id="uploader" type="file" onchange="upload(this.files, this)" />
        <button class="button-primary" onClick="sendUpload()">上傳</button>
      </p>
      <form class="flex flex-row flex-space-between" id="send-message">
        <input type="text" name="text" class="flex flex-1">
        <button class="button-primary" type="submit">Send</button>
      </form>
    </div>
  </div>
</main>`;

// Helper to safely escape HTML
const escape = (str) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Add a new user to the list
const addUser = (user) => {
  const userList = document.querySelector(".user-list");

  if (userList) {
    // Add the user to the list
    userList.innerHTML += `<li>
      <a class="block relative" href="#">
        <img src="${user.avatar}" alt="" class="avatar">
        <span class="absolute username">${escape(
          user.name || user.email
        )}</span>
      </a>
    </li>`;

    // Update the number of users
    const userCount = document.querySelectorAll(".user-list li").length;

    document.querySelector(".online-count").innerHTML = userCount;
  }
};

// Renders a message to the page
const addMessage = (message) => {
  // The user that sent this message (added by the populate-user hook)
  const { user = {} } = message;  
  AddChatItem(user, message);
};

function AddChatItem(user, message=null){
  // Escape HTML to prevent XSS attacks
  const text = message ? escape(message.text) : "";
  const chat = document.querySelector(".chat");
  if (chat) {
    chat.innerHTML += `<div class="message flex flex-row">
      <img src="${user.avatar}" alt="${user.name || user.email}" class="avatar">
      <div class="message-wrapper">
        <p class="message-header">
          <span class="username font-600">${escape(
            user.name || user.email
          )}</span>
          <span class="sent-date font-300">${
            message == null ?
            moment().format("MMM Do, hh:mm:ss")
            :
            moment(message.createdAt).format("MMM Do, hh:mm:ss")
          }</span>
        </p>
        ${
          message == null?
          ""
          :
          `<p class="message-content font-300">${text}</p>`
        }        
      </div>
    </div>`;

    // Always scroll to the bottom of our message list
    chat.scrollTop = chat.scrollHeight - chat.clientHeight;
  }
}
/////// Displaying pages//
// Show the login page
const showLogin = (error) => {
  if (document.querySelectorAll(".login").length && error) {
    document
      .querySelector(".heading")
      .insertAdjacentHTML(
        "beforeend",
        `<p>There was an error: ${error.message}</p>`
      );
  } else {
    document.getElementById("app").innerHTML = loginHTML;
  }
};

// Shows the chat page
const showChat = async () => {
  document.getElementById("app").innerHTML = chatHTML;

  // Find the latest 25 messages. They will come with the newest first
  const messages = await client.service("messages").find({
    query: {
      $sort: { createdAt: -1 },
      $limit: 25,
    },
  });

  // We want to show the newest message last
  messages.data.reverse().forEach(addMessage);

  // Find all users
  const users = await client.service("users").find();

  // Add each user to the list
  users.data.forEach(addUser);
};

/////// Login and Signup
// Retrieve email/password object from the login/signup page
const getCredentials = () => {
  const user = {
    email: document.querySelector('[name="email"]').value,
    password: document.querySelector('[name="password"]').value,
  };

  return user;
};

// Log in either using the given email/password or the token from storage
const login = async (credentials) => {
  try {
    if (!credentials) {
      // Try to authenticate using an existing token
      G_USER = await client.reAuthenticate();
      console.log(theUser);
    } else {
      // Otherwise log in with the `local` strategy using the credentials we got
      G_USER = await client.authenticate({
        strategy: "local",
        ...credentials,
      });
    }
    // If successful, show the chat page
    showChat();
  } catch (error) {
    // If we got an error, show the login page
    showLogin(error);
  }
};

////// Event listeners and real-time
const addEventListener = (selector, event, handler) => {
  document.addEventListener(event, async (ev) => {
    if (ev.target.closest(selector)) {
      handler(ev);
    }
  });
};

// "Signup and login" button click handler
addEventListener("#signup", "click", async () => {
  // For signup, create a new user and then log them in
  const credentials = getCredentials();

  // First create the user
  await client.service("users").create(credentials);
  // If successful log them in
  await login(credentials);
});

// "Login" button click handler
addEventListener("#login", "click", async () => {
  const user = getCredentials();

  await login(user);
});

// "Logout" button click handler
addEventListener("#logout", "click", async () => {
  await client.logout();
  G_USER=null;
  document.getElementById("app").innerHTML = loginHTML;
});

// "Send" message form submission handler
addEventListener("#send-message", "submit", async (ev) => {
  // This is the message text input field
  const input = document.querySelector('[name="text"]');

  ev.preventDefault();

  // Create a new message and then clear the input field
  await client.service("messages").create({
    text: input.value,
  });  

  input.value = "";
});

// Listen to created events and add the new message in real-time
// client.service("messages").on("created", addMessage);
socket.on('messages created', addMessage);
// We will also see when new users get created in real-time
client.service("users").on("created", addUser);

async function upload(files, tEle) {
  // console.log(files[0].size);
  if(files[0].size > 62960191){
    alert("檔案太大, 不可大於60mb!");
    tEle.value = "";
  };
}
function sendUpload(){ //- 送出socket 上傳
  const fileEle = document.getElementById("uploader");
  const files = fileEle.files;
  if(files.length == 0){
    alert("請先選擇檔案再上傳!");
    return;
  } else if(!files[0].type.includes('image')&&!files[0].type.includes('video')){
    alert("檔案格式錯誤!(允許影片,圖片)");
    fileEle.value = "";
    return;
  }
  socket.emit("upload",{ f:files[0], t: files[0].type, u:G_USER.user });
  fileEle.value = "";
}
socket.on('receive',function(data){
  if(!data || !data.hasOwnProperty('t'))return;
  const typeTwo = data.t.includes('video') ? 'video' : 'image';
  switch (typeTwo) {
    case 'image':
      appendImage(data.f, data.t, data.u);
      break;
    case 'video':
      appendVideo(data.f, data.t, data.u);
      break;
    default:
      break;
  }
});
function appendImage(buf, tType, user){
  AddChatItem(user, null);
  const boxEle = document.querySelector('.message:last-child .message-wrapper');
  const tImage = new Image();
  tImage.src = URL.createObjectURL(new Blob([new Uint8Array(buf)], {type: tType}));
  tImage.width = 500;
  boxEle.appendChild(tImage);
}

function appendVideo(buf, tType, user){
  AddChatItem(user, null);
  const boxEle = document.querySelector('.message:last-child .message-wrapper');
  const video = document.createElement('video');
  video.src =
    URL.createObjectURL(new Blob([new Uint8Array(buf)], {type: tType}));

  video.autoplay = false;
  video.controls = true;
  video.muted = false;
  video.height = 360; // 👈️ in px
  video.width = 480; // 👈️ in px
  boxEle.appendChild(video);
}

// Call login right away so we can show the chat window
// If the user can already be authenticated
login();
