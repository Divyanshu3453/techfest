const chat = document.getElementById("chat");

const input = document.getElementById("query");

const sendButton = document.getElementById("sendButton");



/* ============================
        AUTO FOCUS
============================ */

window.onload = () => {

    input.focus();

};



/* ============================
      AUTO GROW TEXTAREA
============================ */

input.addEventListener("input", () => {

    input.style.height = "auto";

    input.style.height = input.scrollHeight + "px";

});



/* ============================
      FILL EXAMPLE QUESTION
============================ */

function fillQuestion(question){

    input.value = question;

    input.style.height = "auto";

    input.style.height = input.scrollHeight + "px";

    askQuestion();

}



/* ============================
      ENTER TO SEND
============================ */

function handleEnter(event){

    if(event.key === "Enter" && !event.shiftKey){

        event.preventDefault();

        askQuestion();

    }

}



/* ============================
      ASK QUESTION
============================ */

async function askQuestion(){

    const question = input.value.trim();

    if(question===""){

        input.placeholder="Please enter a question";

        input.focus();

        return;

    }



    sendButton.disabled = true;

    sendButton.style.opacity = ".6";

    sendButton.style.cursor = "not-allowed";



    /* Fade Welcome */

    const welcome = document.querySelector(".welcome");

    if(welcome){

        welcome.style.opacity = "0";

        setTimeout(()=>{

            welcome.remove();

        },300);

    }



    /* User Message */

    chat.innerHTML += `

    <div class="user-message">

        <div class="user-bubble">

            ${question}

        </div>

    </div>

    `;



    chat.scrollTop = chat.scrollHeight;



    /* Loading */

    const loading = document.createElement("div");

    loading.className = "loading";

    loading.id = "loading";

    loading.innerHTML =

        "Thinking...";

    chat.appendChild(loading);

    chat.scrollTop = chat.scrollHeight;
        try{

        /* ----------------------------
                Backend Call
        ----------------------------- */

        const response = await fetch("/chat",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                question:question

            })

        });


        if(!response.ok){

            const err = await response.json().catch(()=>({}));

            throw new Error(err.detail || ("Server error " + response.status));

        }

        const data = await response.json();


        /* ----------------------------
            Remove Loading
        ----------------------------- */

        document.getElementById("loading").remove();


        /* ----------------------------
            Clear Text Box
        ----------------------------- */

        input.value="";

        input.style.height="auto";


        /* ----------------------------
            Enable Button
        ----------------------------- */

        sendButton.disabled=false;

        sendButton.style.opacity="1";

        sendButton.style.cursor="pointer";


        /* ----------------------------
            Time
        ----------------------------- */

        const time = new Date().toLocaleTimeString([],{

            hour:"2-digit",

            minute:"2-digit"

        });


        /* ----------------------------
            Build Response
        ----------------------------- */

       let html = `

<div class="bot-message">


    <div class="bot-title">

        ${
            data.cache

            ?

            "⚡ Response served from semantic cache"

            :

            `🔎🤖 AI Answer`

        }


        <span class="time">

            ${time}

        </span>


    </div>



    <div class="card answer-card">


        <div class="text">

            ${data.answer}

        </div>


    </div>

`;



/* ----------------------------
    Show Pinecone Chunks
----------------------------- */






html += `

</div>

`;


        chat.innerHTML+=html;

        chat.scrollTop=chat.scrollHeight;

    }



    catch(error){

        if(document.getElementById("loading")){

            document.getElementById("loading").remove();

        }


        sendButton.disabled=false;

        sendButton.style.opacity="1";

        sendButton.style.cursor="pointer";


        chat.innerHTML+=`

        <div class="bot-message">

            <div class="card">

                ${error.message === "Failed to fetch" ? "Unable to connect to the backend." : error.message}

            </div>

        </div>

        `;

    }

}