let airSpan = document.createElement("span")
let tempSpan = document.createElement("span")
let citySpan = document.createElement("span")
const geolocaDiv = document.querySelector("#geolocationInfo")

function onGeoSuccess(position) {
    let lat = Math.floor(position.coords.latitude);
    let lon = Math.floor(position.coords.longitude);
    console.log(lat, lon)
    
    const serviceKey = 'bd8617a96c9fb01ca5def927dbd4a161';

    const air_pollutionUrl= `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${serviceKey}&units=metric`;
    const curWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${serviceKey}&units=metric`;
    
    getDataWeatherAPIcall(curWeatherUrl,air_pollutionUrl)




}
function onGeoError(){
    alert("Opps, we cann't get your POS.")
}

function getDataWeatherAPIcall(curWeatherUrl, air_pollutionUrl){
    
    console.log(curWeatherUrl);
    console.log(air_pollutionUrl);

    fetch(curWeatherUrl).then(res=>res.json())
    .then(weatherInfo => {
        console.log(weatherInfo.name,weatherInfo.weather[0].main);
        citySpan.innerText = weatherInfo.name + ' ';
        tempSpan.innerText = weatherInfo.weather[0].main+ ' ';

        geolocaDiv.appendChild(tempSpan);
        geolocaDiv.appendChild(citySpan);
    }).catch(e=>console.log(e));
    
    fetch(air_pollutionUrl).then(res=>res.json())
    .then(airInfo => {
        console.log(airInfo.list[0].components.pm2_5);
        airSpan.innerText= '미세먼지 : '+ airInfo.list[0].components.pm2_5 + ' ';
        // 75 > 매우 나쁨   / 좋음 
        geolocaDiv.appendChild(airSpan);
    }).catch(e=>console.log(e));
}

navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError);

 



 
 
