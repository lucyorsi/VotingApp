"use strict";
"use strict";
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
    // efficiency may be really bad
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
function get_public_key_shares() {
    //if bad, return []; we will check length
    return [bigInt(6), bigInt(3)]; // TODO: make it real
}
function beacon(p_id, array, m) {
    return bigInt("2341234123412341234", 10); //TODO: make it real
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
    }
    Pedersen.prototype.make_public_key = function () {
        var public_key_shares = get_public_key_shares(); // grab the others' key shares
        if (public_key_shares.length === this.n &&
            this.public_key_share.equals(public_key_shares[this.party_id])) {
            this.public_key = modProd(public_key_shares, this.p);
        }
    };
    Pedersen.prototype.log_ZKP_prove = function (ciphertexts) {
        var h = ciphertexts.map(function (c) { return c.x; });
        //this.h = h;
        var x = this.public_key_share;
        var y = this.decrypt_shares;
        var alpha = this.secret;
        var w = Array.apply(null, Array(this.num_votes)).map(function () { return randint(this.q); });
        var a = w.map(function (w_i) { return this.g.modPow(w_i, this.p); });
        var b = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            b[i] = h[i].modPow(w[i], this.p);
        }
        var decrypt_shares = h.map(function (h_i) { return h_i.modPow(this.secret, this.p); });
        this.decrypt_shares = decrypt_shares;
        var r = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1) {
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(this.party_id, com, this.q);
            r[i] = w[i].add(alpha.times(c[i]).mod(this.q));
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
    Pedersen.prototype.decrypt = function () {
        var all_verified = this.pedersen_commits_verified.reduce(function (a, b) {
            return a && b;
        });
        if (!all_verified) {
            console.log("Haven't yet finished verifying all other players.");
            return false;
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
