"use strict";

importScripts("BigInteger.js");
importScripts("jssha256.js");
importScripts("vote.js");

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



// 2048 bit MODP Group from https://tools.ietf.org/id/draft-ietf-ipsec-ike-modp-groups-04.txt
var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);
//var p = bigInt(107);
var g = bigInt(2);
var generators = [bigInt(2), bigInt(3), bigInt(5), bigInt(7), bigInt(11),
                  bigInt(13), bigInt(17), bigInt(19), bigInt(23), bigInt(29)] //TODO

var p_to_uni_table;
var n;
var self_voter_id;
var candidates;

var me;


self.addEventListener("message", function(e) {
    var data = e.data;
    switch(data.cmd) {
        case "init":
            n = data.n;
            self_voter_id = data.self_voter_id;
            candidates = data.candidates;
            p_to_uni_table = data.p_to_uni_table;

            me = new CryptoVoter(p, g, n, self_voter_id, candidates, generators,
                                 p_to_uni_table);

            self.postMessage({"cmd": "post_init", 
                              "secret_key": me.secret.toString(16),
                              "public_key_share": me.public_key_share.toString(16)});

            self.postMessage({"cmd": "status_update", "str": "Waiting for other users to send their public key shares", "spinner": true});

            break;

        case "init_from_old":
            n = data.n;
            self_voter_id = data.self_voter_id;
            candidates = data.candidates;
            p_to_uni_table = data.p_to_uni_table;

            var secret_key = bigInt(data.secret_key, 16);
            var public_key_share = bigInt(data.public_key_share, 16);

            me = new CryptoVoter(p, g, n, self_voter_id, candidates, generators,
                                 p_to_uni_table, secret_key, public_key_share);

            self.postMessage({"cmd": "status_update", "str": "Waiting for other users to send their public key shares", "spinner": true});

            break;

        case "public_key_share":
            var keyshare = bigInt(data.keyshare, 16);
            var p_id = parseInt(data.p_id);
            console.log(p_id, keyshare);
            me.receive_public_key_share(p_id, keyshare);

            if (me.make_public_key()){
                console.log("final public key", me.public_key);
                self.postMessage({"cmd": "status_update",
                                  "str": "All public key shares have been received and the public key has been constructed"});
                self.postMessage({"cmd": "display_ballot", "show": true});
            }

            break;

        case "set_vote":
            me.set_vote(data.vote);
            console.log("set vote to:", data.vote);
            console.log("typeof", typeof data.vote);
            
            if (me.public_key){
                self.postMessage({"cmd": "get_all_proofs"});

                var proof = me.encrypt_and_prove();

                console.log("encrypted and finished proof");

                self.postMessage({"cmd": "send_vote_proof", 
                                  "proof": vote_commit_array_to_hex(proof)});

            }
            else {
                console.log("haven't yet been able to construct public key");
            }
            break;

        case "valid_vote":
            me.verify_vote(data.p_id, vote_commit_array_to_bigint(data.proof));
            try_step_1();
            break;

        case "pedersen":
            me.log_ZKP_verify(data.p_id, pedersen_to_bigint(data.proof));
            try_step_2();
            break;
    }
});


var pedersen_proved = false;


function try_step_1(){
    var pedersen = me.calc_vote_step1();

    if (pedersen){
        // everyone has committed their vote proofs, and we have
        // computed our pedersen commit
        
        self.postMessage({"cmd": "status_update", "str": "All voters have submitted their votes and each has been personally verified as valid. Beginning decryption...", "spinner": true});
        
        pedersen_proved = true;
        
        console.log("sending pedersen_proof");
        console.log(pedersen);
        
        self.postMessage({"cmd": "send_pedersen", "proof": pedersen_to_hex(pedersen)});
    }
}

var tally;
function try_step_2(){
    tally = me.calc_vote_step2();

    if (tally){
        // everyone has published pedersen and we have computed
        // the final tally
        console.log("final_vote", tally);

        self.postMessage({"cmd": "final_tally", "tally": bigint_array_to_hex(tally)});
    }
}

