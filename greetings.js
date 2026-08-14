const loginForm = document.querySelector("#LoginForm")
const loginUsername = document.querySelector("#LoginForm input")
const loginButton = document.querySelector("#LoginForm button")

const greeting = document.querySelector("#greeting")
const CLASSNAME_HIDDEN = "hidden";
const KEY_USERNAME = "savedUseruame";

function handleLoginBtnClick(event){
    event.preventDefault();
    const username = loginUsername.value;

    localStorage.setItem(KEY_USERNAME,username);

    pantinGreetings(username);


    loginForm.classList.add(CLASSNAME_HIDDEN);
    console.log(username);

}

function pantinGreetings(username){
    greeting.innerText = `Hello ${username}, let's do what we wanted to do. `;
    greeting.classList.remove(CLASSNAME_HIDDEN);
    
}

loginForm.addEventListener("submit", handleLoginBtnClick);

const savedUserName = localStorage.getItem(KEY_USERNAME)
if ( savedUserName == null ) {
    // show loginform here
    loginForm.classList.remove(CLASSNAME_HIDDEN);
    
} 
else {
    // show greeting here
    pantinGreetings(savedUserName);
}
