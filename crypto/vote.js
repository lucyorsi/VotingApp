/// <reference path="big-integer.d.ts" />
/// <reference path="jssha.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
function flatten(array) {
    return array.reduce(function (new_array, rest) {
        return new_array.concat(Array.isArray(rest) ? flatten(rest) : rest);
    }, []);
}
function modProd(array, m) {
    /** Returns the product of the array mod m **/
    var p = array.reduce(function (a, b) {
        return a.multiply(b).mod(m);
    });
    return p;
}
function hex_to_int(str) {
    return bigInt(str, 16);
}
function randint(r) {
    /* Returns a random integer on [0, r) */
    //TODO: efficiency may be really bad
    var random32 = new Uint32Array(1); // this array will hold the window.crypto 
    // generated random value
    var random = bigInt(0); // this is the value that will be returned
    var i = 0; // represents the "slot" of 32 we are at
    while (bigInt(32).pow(i).lesser(r)) {
        window.crypto.getRandomValues(random32); // gets one 32-bit random value
        // shift the random value over by 32*i and increment random by it
        random = random.add(bigInt(random32[0]).shiftLeft(32 * i));
        i++;
    }
    return random.mod(r);
}
function mod_div(n, d, m) {
    var inverse = d.modPow(m.minus(2), m);
    return n.times(inverse).mod(m);
}
function pad_hex_string(str) {
    if ((str.length % 2) !== 0) {
        str = str + "0";
    }
    return str;
}
function beacon(p_id, array, m) {
    //TODO: should p_id be harder to control? Like a much longer string?
    var all_nums = flatten(array);
    console.log(array);
    var shaObj = new jsSHA("SHA-256", "HEX");
    console.log(pad_hex_string(p_id.toString(16)));
    for (var _i = 0, all_nums_1 = all_nums; _i < all_nums_1.length; _i++) {
        var n = all_nums_1[_i];
        console.log("ntostr", n.toString(16));
        shaObj.update(pad_hex_string(n.toString(16))); // update the SHA with hex representation
    }
    var hash = shaObj.getHash("HEX");
    return bigInt(hash, 16).mod(m);
}
var Pedersen = (function () {
    function Pedersen(p, g, n, party_id, num_votes) {
        this.p = p;
        this.g = g;
        this.n = n;
        this.party_id = party_id;
        this.num_votes = num_votes;
        this.q = p.prev().divide(2);
        this.pedersen_commits_verified = Array.apply(null, Array(n)).map(function () { return false; });
        this.global_decrypt_shares = new Array(n);
        this.secret = randint(this.q);
        this.public_key_share = g.modPow(this.secret, p);
        //TODO: publish_public_key_share(party_id, self.public_key_share);
        this.public_key_shares = new Array(n);
    }
    Pedersen.prototype.receive_public_key_share = function (p_id, share) {
        this.public_key_shares[p_id] = share;
    };
    Pedersen.prototype.make_public_key = function () {
        //var public_key_shares = get_public_key_shares(); // grab the others' key shares
        this.public_key_shares[this.party_id] = this.public_key_share;
        var len = this.public_key_shares.reduce(function (a, b) {
            return a + (typeof b !== "undefined" ? 1 : 0);
        }, 0);
        if (len === this.n) {
            this.public_key = modProd(this.public_key_shares, this.p);
            this.h = this.public_key;
            return this.public_key;
        }
        else {
            return null;
        }
    };
    Pedersen.prototype.log_ZKP_prove = function (ciphertexts) {
        var h = ciphertexts.map(function (c) { return c.x; });
        //this.h = h;
        var x = this.public_key_share;
        var y = this.decrypt_shares;
        var alpha = this.secret;
        var p = this.p;
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
        this.global_decrypt_shares[this.party_id] = decrypt_shares;
        var r = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(this.party_id, com, q);
            r[i] = w[i].add(alpha.times(c[i]).mod(q));
        }
        return { y: y, w: w, a: a, b: b, r: r };
    };
    Pedersen.prototype.log_ZKP_verify = function (p_id, commit) {
        var x = this.public_key_shares[p_id];
        var y = commit.y; //maybe there's a cleaner way....
        var w = commit.w;
        var a = commit.a;
        var b = commit.b;
        var r = commit.r;
        var verified = true;
        for (var i = 0; i < this.num_votes; i += 1) {
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(this.party_id, com, this.q);
            var test1 = this.g.modPow(r[i], this.p).equals(a[i].times(x.modPow(c, this.p)).mod(this.p));
            var test2 = this.public_key.modPow(r[i], this.p).equals(b[i].times(y[i].modPow(c, this.p)).mod(this.p));
            if (!(test1 && test2)) {
                console.log("Could not log ZKP verify" + p_id);
                verified = false;
                break;
            }
        }
        if (verified) {
            this.pedersen_commits_verified[p_id] = true;
            this.global_decrypt_shares[p_id] = y;
        }
        return verified; //TODO: consider if this is necessary
    };
    Pedersen.prototype.log_ZKP_verify_all = function () {
        //TODO: double check this is all we need
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
var Voter = (function (_super) {
    __extends(Voter, _super);
    function Voter(p, g, n, voter_id, options, generators) {
        _super.call(this, p, g, n, voter_id, options.length);
        this.voter_id = voter_id;
        this.options = options;
        this.generators = generators;
        this.votes_verified = Array.apply(null, Array(n)).map(function () { return false; });
        this.votes_verified[voter_id] = true; // obviously we trust ourselves
        this.global_votes = new Array(n);
        this.generator_inverses = generators.map(function (G) { return G.modPow(p.subtract(2), p); });
    }
    Voter.prototype.set_vote = function (vote) {
        //TODO: maybe make sure it's valid
        this.vote = vote;
    };
    Voter.prototype.encrypt_and_prove = function () {
        this.encrypted_vote = new Array(this.num_votes);
        var h = this.public_key;
        this.commits = new Array(this.num_votes);
        var p = this.p;
        var g = this.g;
        var q = this.q;
        var generator_inverses = this.generator_inverses;
        for (var i = 0; i < this.num_votes; i += 1) {
            var alpha = randint(this.q);
            var v = this.vote[i];
            var G = this.generators[i];
            console.log("i:", i);
            console.log("G:", G);
            //var w = random_vector(this.num_votes, this.q); 
            var d = random_vector(this.options[i], q);
            var r = random_vector(this.options[i], q);
            var x = g.modPow(alpha, p);
            var y = h.modPow(alpha, p).times(G).mod(p);
            console.log("h:", h.toString());
            console.log("alpha:", alpha.toString());
            console.log("p:", p.toString());
            console.log("G:", G.toString());
            console.log("y:", y.toString());
            var u = q.subtract(alpha);
            /*var Y = Array.apply(null, Array(this.options[i])).map(function (o, j){
                return y.times(this.generator_inverses[j]);
            });*/
            var Y = range_apply(this.options[i], function (j) { return y.times(generator_inverses[j]); });
            var w = u.times(d[v]).add(r[v]).mod(q);
            var a = range_apply(this.options[i], function (j) { return x.modPow(d[j], p).times(g.modPow(r[i], p)).mod(p); });
            var b = range_apply(this.options[i], function (j) { return Y[j].modPow(d[j], p).times(h.modPow(r[i], p)).mod(p); });
            var c = beacon(this.voter_id, [x, y, Y, a, b], q);
            var prev_d = d[v];
            var prev_r = r[v];
            var d_sum = d.reduce(function (d1, d2) { return d1.add(d2); }).subtract(d[v]);
            d[v] = c.subtract(d_sum).mod(q);
            r[v] = w.subtract(u.times(d[v])).mod(q);
            var new_r = alpha.times(prev_d.subtract(d[v])).add(prev_r).mod(q);
            this.commits[i] = { vote: { x: x, y: y }, Y: Y, a: a, b: b, d: d, r: r };
        }
        return this.commits;
    };
    Voter.prototype.verify_vote = function (p_id, commits) {
        var verified = true; //TODO: double check scope of this guy
        for (var i = 0; i < this.num_votes; i += 1) {
            var commit = commits[i];
            var c = beacon(this.voter_id, [commit.vote.x, commit.vote.y, commit.Y,
                commit.a, commit.b], this.q);
            if (!c.equals(commit.d.reduce(function (d1, d2) {
                return d1.add(d2).mod(this.q);
            }))) {
                verified = false;
            }
            for (var j = 0; j < this.options[i]; j += 1) {
                var test1 = commit.a[j].equals(commit.vote.x.modPow(commit.d[j], this.p).times(this.g.modPow(commit.r[j], this.p)).mod(this.p));
                var test2 = commit.b[j].equals(commit.Y[j].modPow(commit.d[j], this.p).times(this.h.modPow(commit.r[j], this.p)).mod(this.p));
                if (!(test1 && test2)) {
                    verified = false;
                    console.log(p_id + "failed their verification on one of the a or b tests.");
                }
                if (!verified) {
                    break;
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
            }
        }
        if (!verified) {
            this.global_votes[p_id] = null; // remove their votes as they are not valid
            console.log("Failed to verify" + p_id + "on verification. They might be cheating! Abort!");
        }
        else {
            console.log(p_id + "passed verification.");
            this.votes_verified[p_id] = true;
        }
        return verified;
    };
    Voter.prototype.calc_vote_step1 = function () {
        var all_verified = this.votes_verified.reduce(function (a, b) {
            return a && b;
        });
        if (!all_verified) {
            console.log("Cannot continue with decryption, not all voters verified.");
            return null;
        }
        else {
            this.global_votes[this.voter_id] = this.encrypted_vote;
            var ws = new Array(this.num_votes);
            for (var i = 0; i < this.num_votes; i += 1) {
                var w = this.global_votes[i].reduce(function (a, b) {
                    return { x: a.x.times(b.x).mod(this.p), y: a.y.times(b.y).mod(this.p) };
                });
                ws[i] = w;
            }
            this.ws = ws;
            return this.log_ZKP_prove(ws);
        }
    };
    Voter.prototype.calc_vote_step2 = function () {
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
    return Voter;
}(Pedersen));
function test_vote(num_voters, options) {
    if (num_voters === void 0) { num_voters = 2; }
    if (options === void 0) { options = [2]; }
    var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);
    var q = p.prev().divide(2);
    var g = bigInt(2);
    var generators = [bigInt(2), bigInt(4), bigInt(8), bigInt(16)];
    var num_votes = options.length;
    //just a bunch of random votes
    //really shouldn't use random_vector() as that's for BigInteger but I'm super lazy
    //also really need to fix options[0]
    var votes = range_apply(num_voters, function (i) { return random_vector(num_votes, bigInt(options[0])).map(function (x) { return x.toJSNumber(); }); });
    var voters = [];
    var vote_proofs = [];
    for (var i = 0; i < num_voters; i += 1) {
        voters.push(new Voter(p, g, num_voters, i, options, generators));
        voters[voters.length - 1].set_vote(votes[i]);
    }
    for (var i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_voters; j += 1) {
            voters[j].receive_public_key_share(i, voters[i].public_key_share);
        }
    }
    for (var i = 0; i < num_voters; i += 1) {
        voters[i].make_public_key();
        console.log(voters[i].public_key.toString());
        vote_proofs.push(voters[i].encrypt_and_prove());
    }
    for (var i = 0; i < num_voters; i += 1) {
        for (var j = 0; j < num_voters; j += 1) {
            voters[j].verify_vote(i, vote_proofs[i]);
        }
    }
    // normally we might call verify_vote_all() but's it's really necessary here
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
        outs.push(voters[i].calc_vote_step2());
    }
    var test_out = outs[0];
    for (var i = 0; i < num_voters; i += 1) {
        console.assert(test_out === (outs[i]), "Decryption resulted in different values.");
    }
    console.log("Election result:", test_out);
    var expected_out = range_apply(num_votes, function (i) { return votes.reduce(function (x, y) { return x * y[i]; }, 1); });
    console.log("Expected result:", expected_out);
    console.assert(test_out === expected_out, "Bad out");
    console.log("Success!");
}
