const checkBoard = document.querySelector("#checkBoard");
const resetBtn = document.querySelector("#reset");
const challangeForm = document.querySelector("#ChallangeForm");
let myRecodes = [];

const CHALLANGE_KEY = "challange";
const myGoal = challangeForm.querySelector("input");
const CHALLANGE_GOAL = "mygoal";
const STATUS_COMPLATE = "complated";
const STATUS_PROGRESS = "progress";

function setMyGoal(event){
    event.preventDefault();
    printMyGoal(myGoal.value)
    localStorage.setItem(CHALLANGE_GOAL, myGoal.value);
    printGuideText("Recode your progress.")
}

function printMyGoal(text){
    challangeForm.querySelector("h2").innerText = text;    
    myGoal.className = "hidden"
}

function printGuideText(msg){
    challangeForm.querySelector("span:last-child").innerText = msg;
}
challangeForm.addEventListener("submit",setMyGoal);

function complateEffect(){
    const resultSpan = document.querySelector("#guideMessage");
    resultSpan.className = "";
    const buttons = checkBoard.querySelectorAll("button") ;
    buttons.forEach(item=>item.classList.add("complatedEffect"));
}

function completedToday(event){
    // if already complated
    const eventId = parseInt(event.target.id);
    const objIndex = myRecodes.findIndex((obj => obj.id == eventId));
    console.log(myRecodes, event.target.id);
    if (objIndex !== undefined && objIndex >= 0 && myRecodes[objIndex].status === STATUS_COMPLATE) {
        console.log(myRecodes[objIndex].status);
        return;
    }
    
    event.target.classList.add(STATUS_COMPLATE);
    event.target.innerText = "v"
    const complateBtnInfo = {
        "className" : "item complated",
        "id" : event.target.id,
        "status": STATUS_COMPLATE,
        "text" : "v"
    }
    console.log(complateBtnInfo);
    // update array
    myRecodes.push(complateBtnInfo)

    if (myRecodes.length < 30){
        const nextBtnInfo = {
            "className" : "item progress",
            "id" : eventId+1,
            "status": STATUS_PROGRESS,
            "text" : eventId+1
        }

        paintTodayBtn( nextBtnInfo);
    
        //myRecodes.push(nextBtnInfo);
    } else {
        complateEffect();
        alert("finally clear!")
    }
    // save to localStorage
    localStorage.setItem(CHALLANGE_KEY,JSON.stringify(myRecodes));

}

function paintTodayBtn(info){

    const newBtn = document.createElement("button");
    newBtn.id=info.id;
    newBtn.className= info.className;
    newBtn.innerText = info.text;

    newBtn.addEventListener("click",completedToday);
    checkBoard.appendChild(newBtn);

}

function paintCheckBoard(){

   myRecodes.map(function(item) {
        
       const btnInfo = {
           "className" : item.className,
           "id" : item.id,
           "status": item.status,
           "text" : item.text
       } 
       paintTodayBtn( btnInfo);

   }); 
   // draw one more
   const newBtnInfo = {
       "className" : "item progress",
       "id" : myRecodes.length,
       "status": STATUS_PROGRESS,
       "text" : myRecodes.length
   }
   paintTodayBtn(newBtnInfo);

    const result = myRecodes.filter(item => item.status === STATUS_COMPLATE);
    if (result.length === 0 && myRecodes.length > 28){ complateEffect(); return;}

}


const savedRecodes = localStorage.getItem(CHALLANGE_KEY);
if(savedRecodes !== null){
    myRecodes = JSON.parse(savedRecodes);
}

function resetChallange(event){
    
    if (confirm("모든 저장된 기록이 사라져요. 계속할까요?") == true) {
        localStorage.removeItem(CHALLANGE_KEY);
        localStorage.removeItem(CHALLANGE_GOAL);
        
        location.reload();
    } else {
        return;
    }
 
}

resetBtn.addEventListener("click",resetChallange);

paintCheckBoard();


const savedMyGoal = localStorage.getItem(CHALLANGE_GOAL);

if (savedMyGoal !== null){
    printMyGoal(savedMyGoal);
    printGuideText("Check, everyday.")
}
