/**
 * Created by heungseok2 on 2017-07-27.
 */



///////////////// sigma network global data /////////////////////
var network_arr = [];
var array_index = 0;
var current_time = 1;
var time_period_map={
    1:"7.13.~6.14.",
    2:"7.14.~6.15.",
    3:"7.15.~6.16.",
    4:"7.16.~6.17.",
};
// var platform = "ClassCentral";
var platform = "CourseTalk";
var s,
    g = {
        nodes: [],
        edges: []
    };
// s: sigma object, g: graph(network) object

var url_arr = [
    "./data/t1_" + platform + "_network.json",
    "./data/t2_" + platform + "_network.json",
    "./data/t3_" + platform + "_network.json",
    "./data/t4_" + platform + "_network.json"
];

///////////////// parcoords global data /////////////////////
var parcoords = d3.parcoords()("#pc-container")
// this data is used to access POC data as global variable, the usage is find edge in the POC, and sync with network.
var global_data;
var par_data;



/*
 json data import and push to network array
 */
$(document).ready(function(){
    init();
    init_parcoords();

});

function initD3(){
    


}

function init() {

    $.getJSON(url_arr[0], function(data, textStatus, jqXHR){
        network_arr.push(data);
        sigma_init(network_arr[0]);

    });

    for(var i=1; i<url_arr.length;i++){
        requestData(i);
    }
}




// incresing Time T and changing and animating network.
function t_plus(){
    console.log("plus!");
    var source_value = parseInt(document.getElementById("min-degree").value);
    var max_value = parseInt(document.getElementById("min-degree").max);

    if(source_value < max_value){
        var target_value = source_value+1;
        current_time = target_value;
        document.getElementById("min-degree").value = target_value;

        // network update
        showValue(target_value);
        changeNetwork(source_value, target_value);

        // parallel coordinates update
        updatePC();

    }
}



// decreasing Time T and changing and animating network.
function t_minus(){


    var source_value = parseInt(document.getElementById("min-degree").value);
    var min_value = parseInt(document.getElementById("min-degree").min);

    if(source_value>min_value){
        // console.log(source_value);
        var target_value = source_value-1;
        current_time = target_value;
        document.getElementById("min-degree").value = target_value;
        showValue(target_value);

        changeNetwork(source_value, target_value);
        updatePC();
    }
}


// automatically increasing degree and changing network
function t_play(){
    var flag = false;
    var timerId = 0 ;

    var source_value = parseInt(document.getElementById("min-degree").value);
    var max_value = parseInt(document.getElementById("min-degree").max);

    var length = max_value-source_value;

    // automatically increasing degree and changing network
    timerId = setInterval(function(){
        if(source_value >= max_value || parseInt(document.getElementById("current_date").innerHTML) >= max_value){
            clearInterval(timerId);
        }else{
            source_value++;
            document.getElementById("min-degree").value = source_value;
            showValue(source_value);
            changeNetwork(source_value-1, source_value);
            updatePC();
        }

    },2000);

}


// show the value of the degree bar
function showValue(newValue)
{
    document.getElementById("current_date").innerHTML=newValue;
    document.getElementById("time_period").innerHTML=time_period_map[newValue];

}


// reset degree
function t_reset() {

    var source_value = parseInt(document.getElementById("min-degree").value);
    if(source_value != 1){
        document.getElementById("min-degree").value = 1;
        current_time = 1;
        showValue(1);
        changeNetwork(source_value, 1);
        updatePC();
    }
}


function switchPlatform(btn_platform) {
    var targetPlatform = btn_platform.innerHTML;

    if(targetPlatform !== platform){
        console.log("switch review platform from-" + platform + " to-" + targetPlatform);
        platform = targetPlatform;
        current_time = 1;
        document.getElementById("min-degree").value = current_time;
        showValue(1);
        cleanNetwork();
        clean_networkCanvas();
        switchNetwork();
        updatePC();
    }
    // 같을 경우 do nothing;
}
