/// <reference path="big-integer.d.ts" />
/// <reference path="jssha.d.ts" />

"use strict";

function flatten(array: Array<any>): Array<any> {
    return array.reduce(function(new_array, rest){
        return new_array.concat(Array.isArray(rest) ? flatten(rest) : rest);
    }, []);
}

function modProd(array: Array<BigInteger>, m: BigInteger){
    /** Returns the product of the array mod m **/

    var p = array.reduce(function (a, b){
        return a.multiply(b).mod(m);
    }, bigInt.one);

    return p;
}

function rmod(n: BigInteger, m: BigInteger): BigInteger {
    /* this function is needed because the BigInt lib thinks
     * -1 mod 2 == -1. Whatever. */

    var r = n.mod(m);
    if (r.isNegative()){
        r = m.add(r);
    }

    return r;
}

function hex_to_int(str: string):BigInteger {
    return bigInt(str, 16);
}

function randint(r: BigInteger):BigInteger {
    /* Returns a random integer on [0, r) */

    //TODO: efficiency may be really bad

    var random32 = new Uint32Array(1); // this array will hold the window.crypto 
                                       // generated random value
    var random = bigInt(0); // this is the value that will be returned
    var i = 0; // represents the "slot" of 32 we are at

    while (bigInt(32).pow(i).lesser(r)){ // make sure we generate more bits than in r
        window.crypto.getRandomValues(random32); // gets one 32-bit random value
        // shift the random value over by 32*i and increment random by it
        random = random.add(bigInt(random32[0]).shiftLeft(32 * i));
        i++;
    }

    return random.mod(r);
}

function mod_div(n: BigInteger, d: BigInteger, m: BigInteger):BigInteger {
    var inverse = d.modPow(m.minus(2), m);
    return n.times(inverse).mod(m);
}

function pad_hex_string(str: string): string {
    if ((str.length % 2) !== 0){
        str = str + "0";
    }
    return str;
}

function beacon(p_id: number, array: Array<any>, m: BigInteger): BigInteger{
    //TODO: should p_id be harder to control? Like a much longer string?
    var all_nums = flatten(array);

    var shaObj = new jsSHA("SHA-256", "HEX");
    shaObj.update(pad_hex_string(p_id.toString(16)));

    for (let n of all_nums){
        shaObj.update(pad_hex_string(n.toString(16))); // update the SHA with hex representation
    }

    var hash = shaObj.getHash("HEX");

    return bigInt(hash, 16).mod(m);
}

interface Pedersen_commit{
    y: Array<BigInteger>;
    w: Array<BigInteger>;
    a: Array<BigInteger>;
    b: Array<BigInteger>;
    r: Array<BigInteger>;
}

interface Ciphertext{
    x: BigInteger;
    y: BigInteger;
}

class Pedersen {
    q: BigInteger;
    pedersen_commits_verified: Array<boolean>;
    global_decrypt_shares: Array<any>; //TODO: share type
    secret: BigInteger;
    public_key_share: BigInteger;
    public_key: BigInteger;
    h: BigInteger;
    decrypt_shares: Array<BigInteger>;
    public_key_shares: Array<BigInteger>;
    ciphertexts: Array<Ciphertext>;
    h_thing: Array<BigInteger>;

    constructor(public p: BigInteger, public g: BigInteger, public n: number, 
                public party_id: number, public num_votes: number){

        this.q = p.prev().divide(2);

        this.pedersen_commits_verified = Array.apply(null, Array(n)).map(function(){return false});
        this.global_decrypt_shares = new Array(n);

        this.secret = randint(this.q);
        this.public_key_share = g.modPow(this.secret, p);
        //TODO: publish_public_key_share(party_id, self.public_key_share);
        
        this.public_key_shares = new Array(n);
    }

    receive_public_key_share(p_id: number, share: BigInteger){
        this.public_key_shares[p_id] = share;
    }

    make_public_key(): BigInteger{
        //var public_key_shares = get_public_key_shares(); // grab the others' key shares
        
        this.public_key_shares[this.party_id] = this.public_key_share;

        var len = this.public_key_shares.reduce(function(a, b){ 
            return a + (typeof b !== "undefined" ? 1 : 0);
        }, 0);

        if (len === this.n){
            this.public_key = modProd(this.public_key_shares, this.p);
            this.h = this.public_key;

            return this.public_key;
        }
        else {
            return null;
        }
    }

    log_ZKP_prove(ciphertexts: Array<Ciphertext>): Pedersen_commit{
        this.ciphertexts = ciphertexts;
        var h = ciphertexts.map(function (c){ return c.x});
        this.h_thing = h;
      
        var x = this.public_key_share;
        var alpha = this.secret;
        console.log(alpha.toString());
        var p = this.p;
        var q = this.q;
        var g = this.g;
        
        var w = Array.apply(null, Array(this.num_votes)).map(function (){ return randint(q); });
        var a = w.map(function (w_i){ return g.modPow(w_i, p); });
        var b = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1){
            b[i] = h[i].modPow(w[i], p);
        }

        var decrypt_shares = h.map(function (h_i){ return h_i.modPow(alpha, p); }); 
        this.decrypt_shares = decrypt_shares;
        var y = this.decrypt_shares;
        this.global_decrypt_shares[this.party_id] = decrypt_shares;

        var r = new Array(this.num_votes);
        for (var i = 0; i < this.num_votes; i += 1){
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(this.party_id, com, q);

            r[i] = w[i].add(alpha.times(c)).mod(q);
        }

        return {y: y, w: w, a: a, b: b, r: r};
    }

    log_ZKP_verify(p_id: number, commit: Pedersen_commit): boolean{
        var h = this.h_thing;
        var x = this.public_key_shares[p_id];

        var y = commit.y; //maybe there's a cleaner way....
        var w = commit.w;
        var a = commit.a;
        var b = commit.b;
        var r = commit.r;

        var verified = true;

        for (var i = 0; i < this.num_votes; i += 1){
            var com = [x, y[i], w[i], a[i], b[i]];
            var c = beacon(p_id, com, this.q);

            var test1 = this.g.modPow(r[i], this.p).equals(
                a[i].times(x.modPow(c, this.p)).mod(this.p));

            var test2 = h[i].modPow(r[i], this.p).equals(
                b[i].times(y[i].modPow(c, this.p)).mod(this.p));

            if (!(test1 && test2)){
                console.log("Could not log ZKP verify", p_id);
                verified = false;
                break;
            }
        }

        if (verified){
            this.pedersen_commits_verified[p_id] = true;
            this.global_decrypt_shares[p_id] = y;
        }

        return verified; //TODO: consider if this is necessary
    }

    log_ZKP_verify_all(): boolean {
        //TODO: double check this is all we need
        return this.pedersen_commits_verified.reduce(function(a, b){ return a && b});
    }

    decrypt(): Array<BigInteger> {
        var all_verified = this.pedersen_commits_verified.reduce(function (a, b){
            return a && b;
        });

        if (!all_verified){
            console.log("Haven't yet finished verifying all other players.");
            return null;
        }
        else {
            var messages = new Array(this.num_votes);

            for (var i = 0; i < this.num_votes; i += 1){
                var l = this.global_decrypt_shares.map((x) => x[i]);
                console.log(l);
                var P = modProd(l, this.p);
                messages[i] = mod_div(this.ciphertexts[i].y, P, this.p);
            }

            return messages;
        }
    }
}

interface Vote_commit {
    vote: Ciphertext;
    Y: Array<BigInteger>;
    a: Array<BigInteger>;
    b: Array<BigInteger>;
    d: Array<BigInteger>;
    r: Array<BigInteger>;
}

function random_vector(length: number, m: BigInteger): Array<BigInteger> {
    return Array.apply(null, Array(length)).map(function (){ return randint(m); });
}

function range_apply(r: number, f: (n: number) => any): Array<any> {
    return Array.apply(null, Array(r)).map(function (x, i){
        return f(i);
    });
}

class Voter extends Pedersen {
    votes_verified: Array<boolean>;
    generator_inverses: Array<BigInteger>;
    global_votes: Array<Array<Ciphertext>>;
    vote: Array<number>;
    encrypted_vote: Array<Ciphertext>;
    commits: Array<Vote_commit>;
    ws: Array<Ciphertext>;
    out: Array<BigInteger>;

    constructor(p: BigInteger, g: BigInteger, n: number, public voter_id: number,
                public options: Array<number>, public generators: Array<BigInteger>){
        
        super(p, g, n, voter_id, options.length);

        this.votes_verified = Array.apply(null, Array(n)).map(function(){ return false; });
        this.votes_verified[voter_id] = true; // obviously we trust ourselves

        this.global_votes = new Array(n);

        this.generator_inverses = generators.map(function(G){ return G.modPow(p.subtract(2), p) });
    }

    set_vote(vote: Array<number>): void {
        //TODO: maybe make sure it's valid
        
        this.vote = vote;
    }

    encrypt_and_prove(): Array<Vote_commit> {
        this.encrypted_vote = new Array(this.num_votes);

        var h = this.public_key;

        this.commits = new Array(this.num_votes);

        var p = this.p;
        var g = this.g;
        var q = this.q;
        var generator_inverses = this.generator_inverses;

        for (var i = 0; i < this.num_votes; i += 1){
            var alpha = randint(q);

            var v = this.vote[i];
            var G = this.generators[v];

            //var w = random_vector(this.num_votes, this.q); 
            var d = random_vector(this.options[i], q); 
            var r = random_vector(this.options[i], q); 

            var x = g.modPow(alpha, p);
            var y = h.modPow(alpha, p).times(G).mod(p);
            this.encrypted_vote[i] = {x: x, y: y};

            //var u = q.subtract(alpha);

            /*var Y = Array.apply(null, Array(this.options[i])).map(function (o, j){
                return y.times(this.generator_inverses[j]);
            });*/

            var Y = range_apply(this.options[i], (j) => y.times(generator_inverses[j]).mod(p));

            //var w = u.times(d[v]).add(r[v]).mod(q);

            var a = range_apply(this.options[i], (j) => x.modPow(d[j], p).times(g.modPow(r[j], p)).mod(p));

            var b = range_apply(this.options[i], (j) => Y[j].modPow(d[j], p).times(h.modPow(r[j], p)).mod(p));

            var c = beacon(this.voter_id, [x, y, Y, a, b], q);

            var prev_d = bigInt(d[v]);
            var prev_r = bigInt(r[v]);

            var d_sum = rmod(d.reduce(function (d1, d2){ return d1.add(d2).mod(q); }, bigInt.zero).subtract(d[v]), q);

            d[v] = rmod(c.subtract(d_sum), q);

            //r[v] = w.subtract(u.times(d[v])).mod(q);
            console.log("(alpha, prev_d, new_d, prev_r, q)");
            console.log(alpha.toString(), prev_d.toString(), d[v].toString(), prev_r.toString(), q.toString());
            var new_r = rmod(alpha.times(prev_d.subtract(d[v])).add(prev_r), q);
            console.log("new_r =", new_r.toString());
            r[v] = new_r;

            var test1 = a[v].equals(x.modPow(d[v], p).times(g.modPow(r[v], p)).mod(p));

            var test2 = b[v].equals(Y[v].modPow(d[v], p).times(h.modPow(r[v], p)).mod(p));

            console.log(test1, test2);


            this.commits[i] = {vote: {x: x, y: y}, Y: Y, a: a, b: b, d: d, r: r};
        }

        return this.commits;
    }

    verify_vote(p_id: number, commits: Array<Vote_commit>): boolean {
        var verified = true; //TODO: double check scope of this guy

        var p = this.p;
        var q = this.q;
        var g = this.g;
        var h = this.public_key;

        for (var i = 0; i < this.num_votes; i += 1){
            var commit = commits[i];

            var c = beacon(p_id, [commit.vote.x, commit.vote.y, commit.Y, 
                           commit.a, commit.b], q);

            if (!c.equals(commit.d.reduce(function (d1, d2){ // make sure c == sum(d)
                return d1.add(d2).mod(q); }, bigInt.zero))){

                    verified = false;
            }

            console.log("test0:", verified);

            for (var j = 0; j < this.options[i]; j += 1){
                var test1 = commit.a[j].equals(commit.vote.x.modPow(commit.d[j], p).times(
                    g.modPow(commit.r[j], p)).mod(p));
                var test2 = commit.b[j].equals(commit.Y[j].modPow(commit.d[j], p).times(
                    h.modPow(commit.r[j], p)).mod(p));

                if (!(test1 && test2)){
                    verified = false;
                    console.log(this.voter_id, "failed to verify", p_id, "on one of the a or b tests.");
                    console.log(test1, test2);
                }
                else {
                    console.log("passed one for", p_id);
                }

                if (!verified){
                    break;
                }
            }

            if (!verified){
                break;
            }
            else {
                if (typeof this.global_votes[p_id] === "undefined"){
                    this.global_votes[p_id] = Array(this.num_votes);
                }

                this.global_votes[p_id][i] = commit.vote;
                console.log("Added", p_id, "'s vote to ", this.voter_id, "'s shares");
            }
        }

        if (!verified){
            this.global_votes[p_id] = null; // remove their votes as they are not valid
            console.log("Failed to verify", p_id, "on verification. They might be cheating! Abort!");
        }
        else {
            console.log(p_id, "passed verification.");
            this.votes_verified[p_id] = true;
        }

        return verified;
    }

    calc_vote_step1(): Pedersen_commit {

        var p = this.p;

        var all_verified = this.votes_verified.reduce(function(a, b){
            return a && b;
        });

        if (!all_verified){
            console.log("Cannot continue with decryption, not all voters verified.");
            return null;
        }
        else {
            this.global_votes[this.voter_id] = this.encrypted_vote;

            var ws = new Array(this.num_votes);

            for (var i = 0; i < this.num_votes; i += 1){
                console.log("global_votes", this.global_votes);
                var w = this.global_votes[i].reduce(function(a, b){
                    return {x: a.x.times(b.x).mod(p), y: a.y.times(b.y).mod(p)};
                });

                ws[i] = w;
            }

            this.ws = ws;

            return this.log_ZKP_prove(ws);
        }
    }

    calc_vote_step2(): Array<BigInteger> {
        if (!this.log_ZKP_verify_all()){
            //not yet verified everyone
            return null;
        }

        else {
            var out = this.decrypt();
            this.out = out;
            return out;
        }
    }
}

function test_vote(num_voters = 2, options = [4]){
    var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);

    var q = p.prev().divide(2);
    var g = bigInt(2);
    var generators = [bigInt(2), bigInt(4), bigInt(8), bigInt(16)];

    var num_votes = options.length;

    //just a bunch of random votes
    //really shouldn't use random_vector() as that's for BigInteger but I'm super lazy
    //also really need to fix options[0]
    //var votes = range_apply(num_voters, (i) => random_vector(num_votes, bigInt(options[0])).map((x) => x.toJSNumber()));
    
    var votes = [[3], [2]];

    var voters = [];

    var vote_proofs = [];

    for (var i = 0; i < num_voters; i += 1){
        voters.push(new Voter(p, g, num_voters, i, options, generators));

        voters[voters.length-1].set_vote(votes[i]);

    }

    for (var i = 0; i < num_voters; i += 1){
        for (var j = 0; j < num_voters; j += 1){
            voters[j].receive_public_key_share(i, voters[i].public_key_share);
        }
    }

    for (var i = 0; i < num_voters; i += 1){
        voters[i].make_public_key();
        if (i == 1){
            console.assert(voters[1].public_key.equals(voters[0].public_key), "Mismatched public keys");
        }
        console.log(voters[i].public_key.toString());
        vote_proofs.push(voters[i].encrypt_and_prove());
    }

    for (var i = 0; i < num_voters; i += 1){
        for (var j = 0; j < num_voters; j += 1){
            voters[j].verify_vote(i, vote_proofs[i]);
        }
    }

    // normally we might call verify_vote_all() but it's not really necessary here
    
    var pedersen_proofs = [];

    for (var i = 0; i < num_voters; i += 1){
        pedersen_proofs.push(voters[i].calc_vote_step1());
    }

    for (i = 0; i < num_voters; i += 1){
        for (var j = 0; j < num_voters; j += 1){
            voters[j].log_ZKP_verify(i, pedersen_proofs[i]);
        }
    }

    var outs = [];

    for (var i = 0; i < num_voters; i += 1){
        var o = voters[i].calc_vote_step2();
        outs[i] = o;

        console.log(o.toString());
    }

    var test_out = outs[0];
    for (var i = 0; i < num_voters; i += 1){
        console.assert(test_out === (outs[i]), "Decryption resulted in different values.");
    }

    console.log("Election result:", test_out);

    var expected_out = range_apply(num_votes, (i) => votes.reduce((x, y) => x*y[i], 1));

    console.log("Expected result:", expected_out);

    console.assert(test_out === expected_out, "Bad out");

    console.log("Success!");
}



    









          





