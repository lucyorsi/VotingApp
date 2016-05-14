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

var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);

p = bigInt(283);

var g = bigInt(60);
var generators = [bigInt(60), bigInt(204), bigInt(71), bigInt(16), bigInt(32)] //TODO

console.log("bigint -> hex test", bigint_array_to_hex([generators]));
console.log(generators.toString(16));

//var p_to_uni_table; these should actually be in vote.js because of the
//var uni_to_p_table; beacon function
var n;
var self_voter_id;
var candidates;

var self_unique_id = localStorage.getItem("unique_id"); 

var socket = io.connect();
console.log("connected to websocket");

var election_id = "8"; //TODO

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
    if (!self_unique_id){
        console.log("still don't have self_unique_id");
        socket.emit("get_self_unique_id");
        return;
    }

    self_voter_id = uni_to_p_table[self_unique_id];

    me = new CryptoVoter(p, g, n, self_voter_id, [candidates], generators);

    //socket.emit("request_public_key_shares", election_id);

    socket.emit("public_key_share", election_id, me.public_key_share.toString(16));

    //socket.emit("test", election_id);
    socket.emit("get_all_public_key_shares", election_id);
    console.log("tryna get all PKS");
}

socket.on("public_key_share", function(data){
    console.log("received public key share");
    if (me){
        var p_id = uni_to_p_table[data.unique_id];
        console.log("from", p_id);
        var keyshare = bigInt(data.key_share, 16);
        me.receive_public_key_share(p_id, keyshare);
    }

    if (!me.public_key){
        me.make_public_key();
    }
});

var buttons = document.getElementsByClassName("input_1");
for (var i = 0; i < buttons.length; i += 1){
    buttons[i].addEventListener('click', function (e) {
        console.log("clicked!");
        e.preventDefault();
        me.set_vote([parseInt(this.value)]);
        encrypt_and_prove();
    });
}

function encrypt_and_prove(){
    if (me.public_key){
        var proof = me.encrypt_and_prove();

        console.log("finished proof");

        socket.emit("send_proof", election_id, "valid_vote", JSON.stringify(vote_commit_array_to_hex(proof)));

        //console.log("JSON proof sent", JSON.stringify(vote_commit_array_to_hex(proof)));
    }

    socket.emit("get_all_proofs", election_id);
}

var pedersen_proved = false;

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
        me.verify_vote(p_id, vote_commit_array_to_bigint(proof));

        try_step_1();
    }
    else if (proof_type == "pedersen" && pedersen_proved){
        me.log_ZKP_verify(p_id, pedersen_to_bigint(proof));

        console.log(me.h);

        try_step_2();
    }
});

function try_step_1(){
    var pedersen = me.calc_vote_step1();

    if (pedersen){
        // everyone has committed their vote proofs, and we have
        // computed our pedersen commit
        
        pedersen_proved = true;
        
        console.log("sending pedersen_proof");
        console.log(pedersen);
        
        socket.emit("send_proof", election_id, "pedersen", JSON.stringify(pedersen_to_hex(pedersen)));

        //socket.emit("get_all_proofs", election_id);
    }
}

var tally;
function try_step_2(){
    tally = me.calc_vote_step2();

    if (tally){
        // everyone has published pedersen and we have computed
        // the final tally
        console.log("final_vote", tally);
        
        socket.emit("final_tally", election_id, tally.toString(16));

        display_final();
    }
}

function display_final(){
    //TODO
    console.log(tally);
}



    

    

