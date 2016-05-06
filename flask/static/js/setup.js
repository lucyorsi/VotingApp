// document.getElementById("uploadBtn").onchange = function () {
//     document.getElementById("uploadFile").value = this.value;
// };
// document.getElementById("uploadBtn2").onchange = function () {
//     document.getElementById("uploadFile2").value = this.value;
// };

$('#min-date').bootstrapMaterialDatePicker({ format : 'DD/MM/YYYY HH:mm', minDate : new Date() });

//auto expand textarea
function adjust_textarea(h) {
    h.style.height = "20px";
    h.style.height = (h.scrollHeight)+"px";
}