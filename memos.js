const memoForm = document.querySelector("#MemoForm");
const memoTitleInput = document.querySelector("#memoTitleInput");
const memoContentInput = document.querySelector("#memoContentInput");
const memoLabelInput = document.querySelector("#memoLabelInput");
const memoList = document.querySelector("#memoList");
const memoLabelOptions = document.querySelector("#memoLabelOptions");

const MEMO_KEY = "memos";
const MEMO_LABEL_KEY = "memoLabels";

let myMemos = [];
let myLabels = [];

function saveMemos() {
        localStorage.setItem(MEMO_KEY, JSON.stringify(myMemos));
}

function saveLabels() {
        localStorage.setItem(MEMO_LABEL_KEY, JSON.stringify(myLabels));
}

function paintLabelOption(label) {
        const option = document.createElement("option");
        option.value = label;
        memoLabelOptions.appendChild(option);
}

function addLabelIfNew(label) {
        if (!label) return;
        if (!myLabels.includes(label)) {
                    myLabels.push(label);
                    saveLabels();
                    paintLabelOption(label);
        }
}

function toggleMemo(event) {
        const li = event.currentTarget.closest("li");
        const body = li.querySelector(".memo-body");
        body.classList.toggle("hidden");
}

function copyMemoContent(event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const li = btn.closest("li");
        const text = li.querySelector(".memo-content").innerText;

    const showCopied = () => {
                const original = btn.innerHTML;
                btn.innerHTML = "✓";
                setTimeout(() => {
                                btn.innerHTML = original;
                }, 1200);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(showCopied).catch(() => {
                                fallbackCopy(text);
                                showCopied();
                });
    } else {
                fallbackCopy(text);
                showCopied();
    }
}

function fallbackCopy(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
                    document.execCommand("copy");
        } catch (err) {
                    console.error(err);
        }
        document.body.removeChild(textarea);
}

function deleteMemo(event) {
        event.stopPropagation();
        const li = event.currentTarget.closest("li");
        const id = Number(li.dataset.id);
        myMemos = myMemos.filter((memo) => memo.id !== id);
        saveMemos();
        li.remove();
}

function paintMemo(memo) {
        const li = document.createElement("li");
        li.className = memo.pinned ? "memo memo-pinned" : "memo";
        li.dataset.id = memo.id;

    const header = document.createElement("div");
        header.className = "memo-header";
        header.addEventListener("click", toggleMemo);

    if (memo.pinned) {
                const pin = document.createElement("span");
                pin.className = "memo-pin-icon";
                pin.innerText = "📌";
                pin.title = "고정된 메모 (삭제되지 않음)";
                header.appendChild(pin);
    } else if (memo.label) {
                const bookmark = document.createElement("span");
                bookmark.className = "memo-label";
                bookmark.innerText = "🔖";
                bookmark.title = memo.label;
                header.appendChild(bookmark);
    }

    const titleSpan = document.createElement("span");
        titleSpan.className = "memo-title";
        titleSpan.innerText = memo.title;
        header.appendChild(titleSpan);

    if (!memo.pinned) {
                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "memo-delete";
                deleteBtn.innerText = "×";
                deleteBtn.title = "Delete memo";
                deleteBtn.addEventListener("click", deleteMemo);
                header.appendChild(deleteBtn);
    }

    const body = document.createElement("div");
        body.className = "memo-body hidden";

    const contentDiv = document.createElement("div");
        contentDiv.className = "memo-content";
        contentDiv.innerText = memo.content;

    const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "memo-copy";
        copyBtn.innerHTML = "📋";
        copyBtn.title = "Copy content";
        copyBtn.addEventListener("click", copyMemoContent);

    body.appendChild(contentDiv);
        body.appendChild(copyBtn);

    li.appendChild(header);
        li.appendChild(body);
        memoList.appendChild(li);
}

function addNewMemo(event) {
        event.preventDefault();
        const title = memoTitleInput.value.trim();
        const content = memoContentInput.value.trim();
        const label = memoLabelInput.value.trim();

    if (!title || !content) return;

    const newMemo = {
                id: Date.now(),
                title: title,
                content: content,
                label: label
    };

    myMemos.push(newMemo);
        saveMemos();
        addLabelIfNew(label);

    memoTitleInput.value = "";
        memoContentInput.value = "";
        memoLabelInput.value = "";

    paintMemo(newMemo);
}

memoForm.addEventListener("submit", addNewMemo);

if (typeof PINNED_MEMOS !== "undefined") {
        PINNED_MEMOS.forEach(paintMemo);
}

const savedMemos = localStorage.getItem(MEMO_KEY);
if (savedMemos !== null) {
        myMemos = JSON.parse(savedMemos);
        myMemos.forEach(paintMemo);
}

const savedLabels = localStorage.getItem(MEMO_LABEL_KEY);
if (savedLabels !== null) {
        myLabels = JSON.parse(savedLabels);
        myLabels.forEach(paintLabelOption);
}
