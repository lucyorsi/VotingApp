"use strict";

console.log("election_id", election_id);

var p_to_uni_table;
var uni_to_p_table;
var n;
var self_voter_id;
var candidates;
var candidate_table;

var self_unique_id = localStorage.getItem("unique_id"); 

var worker = new Worker("../static/js/crypto_single_WW.js");

var socket = io.connect();
console.log("connected to websocket");

//var election_id = "8"; //TODO

socket.emit("get_self_unique_id");

socket.on("unique_id", function(id){
    console.log("received unique id");
    if (!self_unique_id){
        self_unique_id = id;
    }

    console.log("new id", self_unique_id);

    begin_vote();
});

socket.on("unique_id_table", function(data){
    console.log("received table");
    console.log(data);
    var table = data.table;
    candidates = data.candidates;
    candidate_table = data.candidate_table;

    p_to_uni_table = table;

    console.log("before for loop");

    uni_to_p_table = new Array();
    for (var i = 0; i < table.length; i += 1){
        uni_to_p_table[table[i]] = i;
    }

    n = table.length;

    console.log("before calling begin_vote");
    begin_vote();
});

socket.emit("join_election", election_id);


var me;

function begin_vote(){
    console.log("begin vote");

    // these too ifs check to make sure we have our own id
    // and we have already received everything from the server
    // necessary for the vote
    if (!self_unique_id){
        console.log("still don't have self_unique_id");
        socket.emit("get_self_unique_id");
        return;
    }

    if (!p_to_uni_table){
        console.log("still haven't received uni id table");
        return;
    }



    self_voter_id = uni_to_p_table[self_unique_id];

    // if the voter has already generated secret and public key shares,
    // these values will exist in localStorage
    var secret_key = localStorage.getItem("secret_key" + election_id);
    var public_key_share = localStorage.getItem("public_key_share" + election_id);

    // same for finished vote
    var final_tally = localStorage.getItem("final_tally" + election_id);
    // TODO var final_outcome = localStorage.getItem("final_outcome" + election_id);

    if (final_tally){
        // TODO if (final_outcome){
        display_status("Final tally has been decrypted, calculating outcome...", true);
        display_ballot("tally", final_tally);
        calc_tally(parseInt(final_tally));
    }

    else if (secret_key && public_key_share){
        worker.postMessage({"cmd": "init_from_old", "n": n, "self_voter_id": self_voter_id,
                            "candidates": [candidates], "p_to_uni_table": p_to_uni_table,
                            "secret_key": secret_key, "public_key_share": public_key_share});
    }

    else {
        worker.postMessage({"cmd": "init", "n": n, "self_voter_id": self_voter_id,
                            "candidates": [candidates], "p_to_uni_table": p_to_uni_table});
    }


    //socket.emit("test", election_id);
    if (!final_tally){
        socket.emit("get_all_public_key_shares", election_id);
    }
    console.log("tryna get all PKS");
}

var final_decrypted = false;
worker.addEventListener("message", function(e) {
    if (final_decrypted){
        // this is to ensure people can't just change their votes after
        // having already decrypted the final tally
        return;
    }

    var data = e.data;
    console.log("message from worker");
    console.log(e.data);
    switch(data.cmd){
        case "post_init":
            // store the generated keys in local storage, just in case they close the tab
            // later on
            localStorage.setItem("secret_key" + election_id, data.secret_key);
            localStorage.setItem("public_key_share" + election_id, data.public_key_share);

            socket.emit("public_key_share", election_id, data.public_key_share);
            break;

        case "send_vote_proof":
            socket.emit("send_proof", election_id, "valid_vote", JSON.stringify(data.proof));

            display_status("Waiting for other vote proofs...", true);

            display_ballot("submitted");
            
            break;

        case "send_pedersen":
            socket.emit("send_proof", election_id, "pedersen", JSON.stringify(data.proof));

            display_status("Final proof submitted, waiting for other proofs to begin decryption...", true);
            break;

        case "get_all_proofs":
            socket.emit("get_all_proofs", election_id);
            break;

        case "final_tally":
            final_decrypted = true;
            var final_tally = bigInt(data.tally[0], 16);
            // storing in localStorage shows we have already finished the vote
            localStorage.setItem("final_tally" + election_id, final_tally.toString());
            display_final(final_tally.toString());
            calc_tally(final_tally.toJSNumber());
            socket.emit("final_tally", election_id, data.tally);
            break;

        case "status_update":
            display_status(data.str, data.spinner);
            break;

        case "display_ballot":
            display_ballot(data.show);
            break;
    }
});

worker.addEventListener("error", function(e) {
    console.log("error from worker");
    console.log(e);
});

socket.on("public_key_share", function(data){
    console.log("received public key share");

    var p_id = uni_to_p_table[data.unique_id];
    console.log("from", p_id);
    worker.postMessage({"cmd": "public_key_share", "p_id": p_id,
                        "keyshare": data.key_share});

});

var buttons = document.getElementsByClassName("input_1");
for (var i = 0; i < buttons.length; i += 1){
    buttons[i].addEventListener('click', function (e) {
        console.log("clicked!");
        e.preventDefault();
        worker.postMessage({"cmd": "set_vote", "vote": [parseInt(this.value)]});

        display_status("Your vote is being encrypted...", true);
        display_ballot(false);
    });
}

socket.on("proof", function(data){
    console.log("received proof");
    console.log("table", p_to_uni_table);
    var unique_id = data.unique_id;
    var p_id = uni_to_p_table[unique_id];
    console.log("unique_id", unique_id);
    console.log(uni_to_p_table);
    console.log("p_id", p_id);
    var proof_type = data.proof_type;
    var proof = JSON.parse(data.proof);

    console.log(proof);

    if (proof_type == "valid_vote"){
        worker.postMessage({"cmd": "valid_vote", "p_id": p_id, "proof": proof});
    }
    else if (proof_type == "pedersen"){
        worker.postMessage({"cmd": "pedersen", "p_id": p_id, "proof": proof});
    }
});


function display_status(str, show_spinner){
    var show_spinner = show_spinner || false;
    var output = "";
    if (show_spinner && show_spinner !== "undefined"){
        console.log("show_spinner", show_spinner);
        output = '<h1 class="text-center"><i class="fa fa-circle-o-notch fa-spin fa-fw"></i></h1>';
    }

    output += '<h4 class=text-center>' + str + '</h4>';

    document.getElementById("status").innerHTML = output;
}

function display_ballot(show, tally){
    var ballot = document.getElementById("ballot");

    if (show === "submitted"){
        ballot.classList.remove("hidden");
        ballot.innerHTML = '<div class="col-xs-12"><p class="my_p_1">Your vote has been submitted. Please keep the tab until all other voters have submitted their votes, and the final tally has been decrypted.</p></div>';
    }
    else if (show === "tally"){
        ballot.classList.remove("hidden");
        ballot.innerHTML = '<div class="col-xs-12"><p class="my_p_1">All proofs have been personally verified. The vote is now complete. The final tally is: ' + tally + '</p><div id="vote_outcome" class="text-center"></div></div>';
    }
    else if (show) {
        ballot.classList.remove("hidden");
    }
    else {
        ballot.classList.add("hidden");
    }
}


function display_final(tally){
    display_status("Calculating outcome...", true);
    display_ballot("tally", tally);
}

function calc_tally(tally){
    var vote_distribution = new Array(candidates);
    var generators = generators || [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
    
    var tally_tally = function(vote_distribution){
        var prod = 1;
        for (var i = 0; i < vote_distribution.length; i += 1){
            prod *= Math.pow(generators[i], vote_distribution[i]);
        }
        return prod;
    };

    // c stands for candidate
    var _calc_tally = function(sum, c){
        if (c === candidates - 1){
            // put the rest of the votes on the last candidate
            vote_distribution[c] = n - sum; 
            var prod = tally_tally(vote_distribution);
            if (prod == tally){
                // vote_distribution now holds the correct... vote distribution
                return true;
            }
        }
        else {
            for (var i = 0; i < (n - sum + 1); i += 1){
                vote_distribution[c] = i;
                if (_calc_tally(sum + i, c + 1)) return true;
            }
        }

        // we should only get here if we couldn't find a solution
        // bad
        return false;
    };

    var found = _calc_tally(0, 0);
    if (found){
        var html_str = "The final result is: <br />";
        for (var i = 0; i < candidates; i += 1){
            html_str += candidate_table[i] + ": " + vote_distribution[i] + "<br />";
        }
        document.getElementById("vote_outcome").innerHTML = html_str;
    }
    else {
        document.getElementById("vote_outcome").innerHTML = "Final vote outcome could not be calculated. Either a mistake was made in calculation, you are out of sync with the server, someone cheated (very unlikely), or there is a bug in the code.";
    }
    display_status("", false);
}

(function(){
    console.log("hello!");
    display_ballot(false);

    display_status('Initializing, creating secret key...', true);

})();
