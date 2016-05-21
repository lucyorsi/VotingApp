/// <reference path="big-integer.d.ts" />
/// <reference path="jssha.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
function flatten(array) {
    // Flattens nested arrays, no matter how deep.
    return array.reduce(function (new_array, rest) {
        return new_array.concat(Array.isArray(rest) ? flatten(rest) : rest);
    }, []);
}
function modProd(array, m) {
    /** Returns the product of the array mod m **/
    var p = array.reduce(function (a, b) {
        return a.multiply(b).mod(m);
    }, bigInt.one);
    return p;
}
function rmod(n, m) {
    // Returns n mod m, guaranteeing the result is positive. This function is needed
    // because the BigInteger libs will output negative values for mod().
    var r = n.mod(m);
    if (r.isNegative()) {
        r = m.add(r);
    }
    return r;
}
function hex_to_int(str) {
    return bigInt(str, 16);
}
function randint(r) {
    // Returns a random integer on [0, r)
    // Note: this is super hacky, using strings and shit as large numbers
    // BigInteger.js really needs to allow you to create one from an array
    // *shrug*
    var num_bytes = Math.ceil(r.toString(2).length / 8);
    // yes, to find the number of bytes needed we convert it to a binary
    // string... yikes
    // This allows us to get real crypto-secure random numbers in JS! Wow!
    // randoms is an array of random 32 bit ints
    var randoms = new Uint32Array(num_bytes);
    self.crypto.getRandomValues(randoms);
    // We then take this nice array of ints... and turn it into a nasty
    // string that can be interpretted by bigInt
    // Looks like "<int><int><int>..."
    var random_string = "<" + randoms.join("><") + ">";
    // We can finally create the BigInteger by creating it from a string
    // and using base 2^32
    // ...
    return bigInt(random_string, Math.pow(2, 32)).mod(r);
}
function mod_div(n, d, m) {
    // Returns n/d mod m
    // Uses the fact that inverse of d mod m is d^(m-2) mod m
    return n.times(d.modPow(m.minus(2), m)).mod(m);
}
function pad_hex_string(str) {
    // Pads a hex string with "0" so that length of the string is even
    if ((str.length % 2) !== 0) {
        str = str + "0";
    }
    return str;
}
// TRY 1
/*
function beacon(p_id: number, array: Array<any>, m: BigInteger, p_to_uni_table: Array<string>): BigInteger{
    // The function takes in BigIntegers and outputs a hash mod m. It also looks up the
    // unique id of the original submitter to ensure that they can't cheat. Uses SHA256
    // to generate the hash. Input and output of hash is hex.
    //TODO: this will just output 256 bits which is way too small

    var all_nums = flatten(array);

    var shaObj = new jsSHA("SHA-256", "HEX");
    shaObj.update(pad_hex_string(p_to_uni_table[p_id]));


    for (let n of all_nums){
        //console.log(n.toString(16));
        shaObj.update(pad_hex_string(n.toString(16))); // update the SHA with hex representation
    }

    var hash = shaObj.getHash("HEX");

    return bigInt(hash, 16).mod(m);
}
*/
// TRY 2
/*
function beacon(p_id: number, array: Array<any>, m: BigInteger, p_to_uni_table: Array<string>): BigInteger{
    // The function takes in BigIntegers and outputs a hash mod m. It also looks up the
    // unique id of the original submitter to ensure that they can't cheat. Uses SHA256
    // to generate the hash. Input and output of hash is hex.

    var all_nums = flatten(array);

    var shaObj = new jsSHA("SHA-256", "HEX");

    var input_str = p_to_uni_table[p_id];

    for (let n of all_nums){
        input_str += n.toString(16);
    }

    console.log(input_str);

    //var num_segments = Math.ceil(input_str.length / 8); //TODO generalize from 2048/256 = 8?
    var num_segments = 8;
    var segment_length = Math.ceil(input_str.length / num_segments);

    for (var i = 0; i < num_segments; i += 1){
        var segment = input_str.slice(i * segment_length, (i + 1) * segment_length);
        console.log(i, num_segments - 1);
        if (i === num_segments - 1){
            console.log("hi");
            segment = pad_hex_string(segment);
        }
        console.log(segment.length);
       
        shaObj.update(segment);
    }

    var hash = shaObj.getHash("HEX");

    return bigInt(hash, 16).mod(m);
}
*/
// TRY 3
function beacon(p_id, array, m, p_to_uni_table) {
    // The function takes in BigIntegers and outputs a hash mod m. It also looks up the
    // unique id of the original submitter to ensure that they can't cheat. Uses SHA256
    // to generate the hash. Input and output of hash is hex.
    var all_nums = flatten(array);
    // input_str is just a concatentation of the unique and every integer in the given
    // array, all in hex.
    var input_str = p_to_uni_table[p_id];
    for (var _i = 0, all_nums_1 = all_nums; _i < all_nums_1.length; _i++) {
        var n = all_nums_1[_i];
        input_str += n.toString(16);
    }
    var hash = "";
    // The number of times we need to run the hash in order to make sure it has equal to
    // or more than the number of bits in m
    var hash_times = Math.ceil(m.toString(2).length / 256);
    // Now we just set the output string, hash, to 
    // hash(1 | input_str) | hash(2 | input_str) | ...
    // This ensures we have enough output width and that the entire hash is still
    // dependent on every input bit
    for (var i = 0; i < hash_times; i += 1) {
        var shaObj = new jsSHA("SHA-256", "HEX");
        shaObj.update(pad_hex_string(i + input_str));
        hash += shaObj.getHash("HEX");
    }
    return bigInt(hash, 16).mod(m);
}
var Pedersen = (function () {
    function Pedersen(p, g, n, party_id, num_votes, p_to_uni_table, secret) {
        if (secret === void 0) { secret = null; }
        this.p = p;
        this.g = g;
        this.n = n;
        this.party_id = party_id;
        this.num_votes = num_votes;
        this.p_to_uni_table = p_to_uni_table;
        this.double_q = p.prev();
        this.q = this.double_q.divide(2);
        this.pedersen_commits_verified = Array.apply(null, Array(n)).map(function () { return false; });
        this.global_decrypt_shares = new Array(n);
        if (secret === null) {
            this.secret = randint(this.q);
        }
        else {
            this.secret = secret;
        }
        this.public_key_share = g.modPow(this.secret, p);
        this.public_key_shares = new Array(n);
    }
    Pedersen.prototype.receive_public_key_share = function (p_id, share) {
        // Stores another users public key share
        this.public_key_shares[p_id] = share;
    };
    Pedersen.prototype.make_public_key = function () {
        // Constructs the public key from all the public key shares.
        // If number of shares receieved is unsufficient, returns null.
        // Otherwise, returns the constructed public key.
        this.public_key_shares[this.party_id] = this.public_key_share;
        var num_received_shares = this.public_key_shares.reduce(function (a, b) { return a + (typeof b !== "undefined" ? 1 : 0); }, 0);
        if (num_received_shares === this.n) {
            this.public_key = modProd(this.public_key_shares, this.p);
            this.h = this.public_key;
            return this.public_key;
        }
        else {
            console.log("Public cannot yet be constructed; still missing " + (this.n - num_received_shares) + " shares.");
            return null;
        }
    };
    Pedersen.prototype.log_ZKP_prove = function (ciphertexts) {
        this.ciphertexts = ciphertexts;
        var h = ciphertexts.map(function (c) { return c.x; });
        this.h_thing = h;
        var x = this.public_key_share;
        var alpha = this.secret;
        var p = this.p;
        var double_q = this.double_q;
        var q = this.q;
        var g = this.g;
        var w = Array.apply(null, Array(this.num_votes)).map(function () { return randint(q); });
        var a = w.map(function (w_i) { return g.modPow(w_i, p); });
        var b = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            b[i] = h[i].modPow(w[i], p);
        }
        var decrypt_shares = h.map(function (h_i) { return h_i.modPow(alpha, p); });
        this.decrypt_shares = decrypt_shares;
        var y = this.decrypt_shares;
        this.global_decrypt_shares[this.party_id] = decrypt_shares;
        var r = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(this.party_id, com, double_q, this.p_to_uni_table);
            r[i] = w[i].add(alpha.times(c)).mod(double_q);
        }
        return { y: y, w: w, a: a, b: b, r: r };
    };
    Pedersen.prototype.log_ZKP_verify = function (p_id, commit) {
        var h = this.h_thing;
        var x = this.public_key_shares[p_id];
        var y = commit.y; //maybe there's a cleaner way....
        var w = commit.w;
        var a = commit.a;
        var b = commit.b;
        var r = commit.r;
        var verified = true;
        for (var i = 0; i < this.num_votes; i += 1) {
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(p_id, com, this.double_q, this.p_to_uni_table);
            var test1 = this.g.modPow(r[i], this.p).equals(a[i].times(x.modPow(c, this.p)).mod(this.p));
            var test2 = h[i].modPow(r[i], this.p).equals(b[i].times(y[i].modPow(c, this.p)).mod(this.p));
            if (!(test1 && test2)) {
                console.log("Could not log ZKP verify", p_id);
                verified = false;
                break;
            }
        }
        if (verified) {
            this.pedersen_commits_verified[p_id] = true;
            this.global_decrypt_shares[p_id] = y;
        }
        return verified;
    };
    Pedersen.prototype.log_ZKP_verify_all = function () {
        return this.pedersen_commits_verified.reduce(function (a, b) { return a && b; });
    };
    Pedersen.prototype.decrypt = function () {
        var all_verified = this.pedersen_commits_verified.reduce(function (a, b) {
            return a && b;
        });
        if (!all_verified) {
            console.log("Haven't yet finished verifying all other players.");
            return null;
        }
        else {
            var messages = new Array(this.num_votes);
            for (var i = 0; i < this.num_votes; i += 1) {
                var l = this.global_decrypt_shares.map(function (x) { return x[i]; });
                console.log(l);
                var P = modProd(l, this.p);
                messages[i] = mod_div(this.ciphertexts[i].y, P, this.p);
            }
            return messages;
        }
    };
    return Pedersen;
}());
function random_vector(length, m) {
    return Array.apply(null, Array(length)).map(function () { return randint(m); });
}
function range_apply(r, f) {
    return Array.apply(null, Array(r)).map(function (x, i) {
        return f(i);
    });
}
var CryptoVoter = (function (_super) {
    __extends(CryptoVoter, _super);
    function CryptoVoter(p, g, n, voter_id, options, generators, p_to_uni_table, secret) {
        if (secret === void 0) { secret = null; }
        _super.call(this, p, g, n, voter_id, options.length, p_to_uni_table, secret);
        this.voter_id = voter_id;
        this.options = options;
        this.generators = generators;
        this.p_to_uni_table = p_to_uni_table;
        console.log("options", options);
        this.votes_verified = Array.apply(null, Array(n)).map(function () { return false; });
        //this.votes_verified[voter_id] = true; // obviously we trust ourselves
        this.global_votes = new Array(n);
        this.generator_inverses = generators.map(function (G) { return G.modPow(p.subtract(2), p); });
    }
    CryptoVoter.prototype.set_vote = function (vote) {
        //TODO: maybe make sure it's valid
        this.vote = vote;
    };
    CryptoVoter.prototype.encrypt_and_prove = function () {
        // First encrypts each of the voter's votes, and the does the ZKPs to prove they
        // are valid. Taken from diagram 3 of the VOTEPAPER.
        // Make sure we know our own vote
        if (typeof this.vote === "undefined") {
            console.log(" *Cannot encrypt vote; vote has not yet been set.");
            return null;
        }
        // shorter names for more readability
        var p = this.p;
        var g = this.g;
        var h = this.public_key;
        var double_q = this.double_q;
        var q = this.q;
        var generator_inverses = this.generator_inverses;
        // this will contain the array of (x, y) pairs of each encryption
        this.encrypted_vote = new Array(this.num_votes);
        // this will contain the final commits of the form ((x, y), Y, a, b, d, r)
        this.commits = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            // the random key for this vote
            var alpha = randint(q);
            var v = this.vote[i];
            var G = this.generators[v];
            // start part 1
            // d and r, which are just vectors (arrays) of random values,
            // will be are kept secret in the first round of the ZKP. Then, we will
            // modify one value from each at index v. We are only able to do so if our vote
            // actually is just one of the generators and if we know alpha
            var d = random_vector(this.options[i], q);
            var r = random_vector(this.options[i], q);
            // (x, y) = (g^alpha, h^alpha * G)
            var x = g.modPow(alpha, p);
            var y = h.modPow(alpha, p).times(G).mod(p);
            this.encrypted_vote[i] = { x: x, y: y };
            // Y is a vector of (y/g_0, y/g_1, ... ) where g_i are the valid generators
            var Y = range_apply(this.options[i], function (j) { return y.times(generator_inverses[j]).mod(p); });
            // a and b "commit" the prover (us) for the first part
            var a = range_apply(this.options[i], function (j) { return x.modPow(d[j], p).times(g.modPow(r[j], p)).mod(p); });
            var b = range_apply(this.options[i], function (j) { return Y[j].modPow(d[j], p).times(h.modPow(r[j], p)).mod(p); });
            // end of the first part
            // Instead of sending (x, y, Y, a, b) to the verifier, and have them then
            // challenge us with a random value for c, we can instead simply do
            // c = hash(our unique id | commit). This allows to both avoid the large
            // network overhead as well as preventing the case of the malicious verifier
            var c = beacon(this.voter_id, [x, y, Y, a, b], double_q, this.p_to_uni_table);
            // start part 2
            var prev_d = bigInt(d[v]);
            var prev_r = bigInt(r[v]);
            // sum(d)
            var d_sum = d.reduce(function (d1, d2) { return d1.add(d2).mod(double_q); }, bigInt.zero);
            // Set the d value at index v, our vote, to c - sum(d) + d[v]
            // This ensures that c is equal to the sum of the modified d which will be
            // verified by the verifier
            d[v] = rmod(c.subtract(d_sum).add(prev_d), double_q);
            // The new r value at index v is (alpha * (previous d - new d)) + previous r
            // This ensures that TODO explain
            r[v] = rmod(alpha.times(prev_d.subtract(d[v])).add(prev_r), double_q);
            // Add this value to the commit array
            this.commits[i] = { vote: { x: x, y: y }, Y: Y, a: a, b: b, d: d, r: r };
        }
        // Obviously we trust ourselves, but we  also want to make sure this is
        // set only after having actually encrypted our own vote
        this.votes_verified[this.voter_id] = true;
        console.log("Encrypted vote and generated corresponding ZKP.");
        return this.commits;
    };
    CryptoVoter.prototype.verify_vote = function (p_id, commits) {
        if (this.votes_verified[p_id]) {
            // We have already verified a vote from this person.
            // We can thus safely return true. Note this also means
            // that we will not accept any "new" votes by anyone.
            return true;
        }
        var verified = true;
        var p = this.p;
        var double_q = this.double_q;
        var q = this.q;
        var g = this.g;
        var h = this.public_key;
        for (var i = 0; i < this.num_votes; i += 1) {
            var commit = commits[i];
            var c = beacon(p_id, [commit.vote.x, commit.vote.y, commit.Y,
                commit.a, commit.b], double_q, this.p_to_uni_table);
            if (!c.equals(commit.d.reduce(function (d1, d2) {
                return d1.add(d2).mod(double_q);
            }, bigInt.zero))) {
                verified = false;
            }
            console.log("test0:", verified);
            for (var j = 0; j < this.options[i]; j += 1) {
                if (!verified) {
                    break;
                }
                var test1 = commit.a[j].equals(commit.vote.x.modPow(commit.d[j], p).times(g.modPow(commit.r[j], p)).mod(p));
                var test2 = commit.b[j].equals(commit.Y[j].modPow(commit.d[j], p).times(h.modPow(commit.r[j], p)).mod(p));
                if (!(test1 && test2)) {
                    verified = false;
                    console.log(this.voter_id, "failed to verify", p_id, "on one of the a or b tests.");
                    console.log(test1, test2);
                }
                else {
                    console.log("passed one for", p_id);
                }
            }
            if (!verified) {
                break;
            }
            else {
                if (typeof this.global_votes[p_id] === "undefined") {
                    this.global_votes[p_id] = Array(this.num_votes);
                }
                this.global_votes[p_id][i] = commit.vote;
                console.log("Added", p_id, "'s vote to ", this.voter_id, "'s shares");
            }
        }
        if (!verified) {
            this.global_votes[p_id] = null; // remove their votes as they are not valid
            console.log("Failed to verify", p_id, "on verification. They might be cheating! Abort!");
        }
        else {
            console.log(p_id, "passed verification.");
            this.votes_verified[p_id] = true;
        }
        return true;
    };
    CryptoVoter.prototype.calc_vote_step1 = function () {
        var p = this.p;
        var all_verified = this.votes_verified.reduce(function (a, b) {
            return a && b;
        });
        console.log("in calc_vote_step1, this.votes_verified", this.votes_verified);
        if (!all_verified) {
            console.log("Cannot continue with decryption, not all voters verified.");
            return null;
        }
        else {
            this.global_votes[this.voter_id] = this.encrypted_vote;
            var ws = new Array(this.num_votes);
            console.log("global_votes", this.global_votes);
            for (var i = 0; i < this.num_votes; i += 1) {
                var vote_array = this.global_votes.map(function (voter) { return voter[i]; });
                var w = vote_array.reduce(function (a, b) {
                    return { x: a.x.times(b.x).mod(p), y: a.y.times(b.y).mod(p) };
                });
                ws[i] = w;
            }
            this.ws = ws;
            return this.log_ZKP_prove(ws);
        }
    };
    CryptoVoter.prototype.calc_vote_step2 = function () {
        if (!this.log_ZKP_verify_all()) {
            //not yet verified everyone
            return null;
        }
        else {
            var out = this.decrypt();
            this.out = out;
            return out;
        }
    };
    return CryptoVoter;
}(Pedersen));
function test_vote(num_voters, options) {
    if (num_voters === void 0) { num_voters = 4; }
    if (options === void 0) { options = [4]; }
    var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);
    p = bigInt(107);
    var q = p.prev().divide(2);
    var g = bigInt(2);
    var generators = [bigInt(2), bigInt(4), bigInt(8), bigInt(16)];
    var num_votes = options.length;
    //just a bunch of random votes
    //really shouldn't use random_vector() as that's for BigInteger but I'm super lazy
    //also really need to fix options[0]
    var votes = range_apply(num_voters, function (i) { return random_vector(num_votes, bigInt(options[0])).map(function (x) { return x.toJSNumber(); }); });
    //var votes = [[0], [3]];
    var voters = [];
    var vote_proofs = [];
    var p_to_uni_table = new Array(num_voters);
    for (var i = 0; i < num_voters; i += 1) {
        p_to_uni_table[i] = Math.random().toString(16).substring(2).toUpperCase();
    }
    for (var i = 0; i < num_voters; i += 1) {
        voters.push(new CryptoVoter(p, g, num_voters, i, options, generators, p_to_uni_table));
        voters[voters.length - 1].set_vote(votes[i]);
    }
    for (var i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_voters; j += 1) {
            voters[j].receive_public_key_share(i, voters[i].public_key_share);
        }
    }
    for (var i = 0; i < num_voters; i += 1) {
        voters[i].make_public_key();
        if (i == 1) {
            console.assert(voters[1].public_key.equals(voters[0].public_key), "Mismatched public keys");
        }
        //console.log(voters[i].public_key.toString());
        vote_proofs.push(voters[i].encrypt_and_prove());
    }
    for (var i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_voters; j += 1) {
            voters[j].verify_vote(i, vote_proofs[i]);
        }
    }
    // normally we might call verify_vote_all() but it's not really necessary here
    var pedersen_proofs = [];
    for (var i = 0; i < num_voters; i += 1) {
        pedersen_proofs.push(voters[i].calc_vote_step1());
    }
    for (i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_voters; j += 1) {
            voters[j].log_ZKP_verify(i, pedersen_proofs[i]);
        }
    }
    var outs = [];
    for (var i = 0; i < num_voters; i += 1) {
        var o = voters[i].calc_vote_step2();
        outs[i] = o;
    }
    var test_out = outs[0];
    for (var i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_votes; j += 1) {
            console.assert(test_out[j].equals(outs[i][j]), "Decryption resulted in different values.");
        }
    }
    console.log("Election result:", test_out);
    var expected_out = range_apply(num_votes, function (i) { return votes.map(function (v) { return v[i]; }).reduce(function (x, y) { return x.multiply(generators[y]).mod(p); }, bigInt.one); });
    console.log("Expected result:", expected_out);
    for (var i = 0; i < num_votes; i += 1) {
        console.assert(test_out[i].equals(expected_out[i]), "Bad out");
    }
    console.log("Success!");
}
