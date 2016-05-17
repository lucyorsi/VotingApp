"use strict";

function bigint_array_to_hex(array) {
    return array.map(function (val) {
        if (Array.isArray(val)) {
            return bigint_array_to_hex(val);
        }
        else {
            return val.toString(16);
        }
    });
}

function hex_array_to_bigint(array) {
    return array.map(function (val) {
        if (Array.isArray(val)) {
            return hex_array_to_bigint(val);
        }
        else {
            return bigInt(val, 16);
        }
    });
}

function vote_commit_to_hex(commit) {
    return {vote: {x: commit.vote.x.toString(16), y: commit.vote.y.toString(16)},
            Y: bigint_array_to_hex(commit.Y),
            a: bigint_array_to_hex(commit.a),
            b: bigint_array_to_hex(commit.b),
            d: bigint_array_to_hex(commit.d),
            r: bigint_array_to_hex(commit.r),};
}

function vote_commit_to_bigint(commit) {
    return {vote: {x: bigInt(commit.vote.x, 16), y: bigInt(commit.vote.y, 16)},
            Y: hex_array_to_bigint(commit.Y),
            a: hex_array_to_bigint(commit.a),
            b: hex_array_to_bigint(commit.b),
            d: hex_array_to_bigint(commit.d),
            r: hex_array_to_bigint(commit.r)};
}

function vote_commit_array_to_hex(array) {
    return array.map(function (commit){
        return vote_commit_to_hex(commit);
    });
}

function vote_commit_array_to_bigint(array) {
    return array.map(function (commit){
        return vote_commit_to_bigint(commit);
    });
}

function pedersen_to_hex(commit) {
    return {
        y: bigint_array_to_hex(commit.y),
        w: bigint_array_to_hex(commit.w),
        a: bigint_array_to_hex(commit.a),
        b: bigint_array_to_hex(commit.b),
        r: bigint_array_to_hex(commit.r)};
}

function pedersen_to_bigint(commit) {
    return {
        y: hex_array_to_bigint(commit.y),
        w: hex_array_to_bigint(commit.w),
        a: hex_array_to_bigint(commit.a),
        b: hex_array_to_bigint(commit.b),
        r: hex_array_to_bigint(commit.r)};
}

function pedersen_array_to_hex(array) {
    return array.map(function (commit){
        return pedersen_to_hex(commit);
    });
}

function pedersen_array_to_bigint(array) {
    return array.map(function (commit){
        return pedersen_to_bigint(commit);
    });
}

var p_to_uni_table;
var uni_to_p_table;
var n;
var self_voter_id;
var candidates;

var self_unique_id = localStorage.getItem("unique_id"); 

var worker = new Worker("../static/js/crypto_single_WW.js");

var socket = io.connect();
console.log("connected to websocket");

var election_id = "8"; //TODO

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

    var randoms = new Uint32Array(16384); // this magic number is the maximum
                                          // number of ints we can pull from 
                                          // crypto.random without exceeding
                                          // the number of bytes of entropy
                                          // available

    if (secret_key && public_key_share){
        worker.postMessage({"cmd": "init_from_old", "n": n, "self_voter_id": self_voter_id,
                            "candidates": [candidates], "p_to_uni_table": p_to_uni_table,
                            "secret_key": secret_key, "public_key_share": public_key_share,
                            "randoms": randoms});
    }
    else {
        worker.postMessage({"cmd": "init", "n": n, "self_voter_id": self_voter_id,
                            "candidates": [candidates], "p_to_uni_table": p_to_uni_table,
                            "randoms": randoms});
    }


    //socket.emit("test", election_id);
    socket.emit("get_all_public_key_shares", election_id);
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
            display_final(bigInt(data.tally[0], 16).toString());
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
        ballot.innerHTML = '<div class="col-xs-12"><p class="my_p_1">The final tally is: ' + tally + '</p></div>';
    }
    else if (show) {
        ballot.classList.remove("hidden");
    }
    else {
        ballot.classList.add("hidden");
    }
}


function display_final(tally){
    display_status("All proofs have been personally verified. The vote is now complete.");
    display_ballot("tally", tally);
}

(function(){
    console.log("hello!");
    display_ballot(false);

    display_status('Initializing...', true);

})();
