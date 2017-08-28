/**
 * Created by heungseok2 on 2017-08-28.
 */


function initUI(){
    // set checkboxes as true;
    $('input.cb_network[type=checkbox]').each(function(){
        this.checked = true;
    });
}


// ************** Control d3 ***************** //
function control_network_component(item) {
    console.log(item.value);
    console.log(item.checked);
    if (item.checked){
        document.getElementById(item.value).style.display = null;
    }else{
        document.getElementById(item.value).style.display = "none";
    }


}













// **************** Modal UI **************** //
// get the modal
var modal = document.getElementById("aboutModal");
// get the button that opens the modal
var btn = document.getElementById("about");
// get the <span> element that cloases the modal;
var span = document.getElementsByClassName("close")[0];
// When the user clicks the button, open the modal
btn.onclick = function () {
    modal.style.display = "block";
};
// When the user clicks on <span> (x), close the modal
span.onclick = function () {
    modal.style.display = "none";
};
// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if(event.target == modal){
        modal.style.display = "none";
    }
}
