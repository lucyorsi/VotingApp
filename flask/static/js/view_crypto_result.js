var socket = io.connect();

socket.emit("join_crypto_view", election_id);

var table = []

socket.on("view_full_table", function(data){
    table = data.table;
    render_table();
});

socket.on("view_update", function(data){
    table[data.email] = data.stat;
    render_table();
});

var statuses = ["Hasn't yet submitted public key share",
                "Submitted public key share",
                "Submitted vote and proof of valid vote",
                "Submitted final Pedersen commit, decrypting..."];

function render_table(){
    var html_str = "";
    
    var all_done = true;
    for (var email in table){
        html_str += email + ": " + statuses[parseInt(table[email])] + "<br />";
        if (parseInt(table[email]) != 3){
            all_done = false;
        }
    }

    if (all_done) {
        html_str = "The vote is complete.";
    }

    document.getElementById("status_table").innerHTML = html_str;
}

