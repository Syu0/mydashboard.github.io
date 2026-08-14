const favoritesBar = document.querySelector("#favoritesBar");
const addFavoriteBtn = document.querySelector("#addFavoriteBtn");
const favoriteForm = document.querySelector("#FavoriteForm");
const favoriteNameInput = document.querySelector("#favoriteNameInput");
const favoriteUrlInput = document.querySelector("#favoriteUrlInput");
const cancelFavoriteBtn = document.querySelector("#cancelFavoriteBtn");

const FAVORITE_KEY = "favorites";
const FAVORITE_HIDDEN_CLASS = "hidden";

let myFavorites = [];

function saveFavorites() {
        localStorage.setItem(FAVORITE_KEY, JSON.stringify(myFavorites));
}

function normalizeUrl(url) {
        if (!/^https?:\/\//i.test(url)) {
                    return `https://${url}`;
        }
        return url;
}

function getFaviconUrl(url) {
        try {
                    const { hostname } = new URL(url);
                    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
        } catch (e) {
                    return "";
        }
}

function deleteFavorite(event) {
        event.preventDefault();
        event.stopPropagation();
        const item = event.currentTarget.closest(".favorite-item");
        const id = Number(item.dataset.id);
        myFavorites = myFavorites.filter((favorite) => favorite.id !== id);
        saveFavorites();
        item.remove();
}

function paintFavorite(favorite) {
        const link = document.createElement("a");
        link.className = "favorite-item";
        link.dataset.id = favorite.id;
        link.href = favorite.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = favorite.name;

    const icon = document.createElement("span");
        icon.className = "favorite-icon";
        const faviconUrl = getFaviconUrl(favorite.url);
        if (faviconUrl) {
                    icon.style.backgroundImage = `url(${faviconUrl})`;
        } else {
                    icon.innerText = favorite.name.charAt(0).toUpperCase();
        }

    const label = document.createElement("span");
        label.className = "favorite-label";
        label.innerText = favorite.name;

    const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "favorite-delete";
        deleteBtn.innerText = "×";
        deleteBtn.title = "삭제";
        deleteBtn.addEventListener("click", deleteFavorite);

    link.appendChild(icon);
        link.appendChild(label);
        link.appendChild(deleteBtn);

    favoritesBar.insertBefore(link, addFavoriteBtn);
}

function showFavoriteForm() {
        favoriteForm.classList.remove(FAVORITE_HIDDEN_CLASS);
        favoriteNameInput.focus();
}

function hideFavoriteForm() {
        favoriteForm.classList.add(FAVORITE_HIDDEN_CLASS);
        favoriteForm.reset();
}

function addNewFavorite(event) {
        event.preventDefault();
        const name = favoriteNameInput.value.trim();
        const url = normalizeUrl(favoriteUrlInput.value.trim());

    if (!name || !url) return;

    const newFavorite = {
                id: Date.now(),
        name: name,
                url: url
    };

    myFavorites.push(newFavorite);
        saveFavorites();
        paintFavorite(newFavorite);
        hideFavoriteForm();
}

addFavoriteBtn.addEventListener("click", showFavoriteForm);
cancelFavoriteBtn.addEventListener("click", hideFavoriteForm);
favoriteForm.addEventListener("submit", addNewFavorite);

const savedFavorites = localStorage.getItem(FAVORITE_KEY);
if (savedFavorites !== null) {
        myFavorites = JSON.parse(savedFavorites);
        myFavorites.forEach(paintFavorite);
}
