/// <reference path="big-integer.d.ts" />
/// <reference path="jssha.d.ts" />
/// <reference path="vote.ts" />
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
/*
class Voter extends CryptoVoter {

    constructor(n: number, voter_id: number, public type_of_vote: string, candidates: any){
        var p = bigInt("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);

        var q = bigInt("7FFFFFFFFFFFFFFFE487ED5110B4611A62633145C06E0E68948127044533E63A0105DF531D89CD9128A5043CC71A026EF7CA8CD9E69D218D98158536F92F8A1BA7F09AB6B6A8E122F242DABB312F3F637A262174D31BF6B585FFAE5B7A035BF6F71C35FDAD44CFD2D74F9208BE258FF324943328F6722D9EE1003E5C50B1DF82CC6D241B0E2AE9CD348B1FD47E9267AFC1B2AE91EE51D6CB0E3179AB1042A95DCF6A9483B84B4B36B3861AA7255E4C0278BA3604650C10BE19482F23171B671DF1CF3B960C074301CD93C1D17603D147DAE2AEF837A62964EF15E5FB4AAC0B8C1CCAA4BE754AB5728AE9130C4C7D02880AB9472D455655347FFFFFFFFFFFFFFF", 16);

        var g = bigInt(2);

        var generators = [bigInt(2), bigInt(4), bigInt(8), bigInt(16)]; //TODO: more generators

        if (type_of_vote === "fptp"){

            super(p, g, n, voter_id, [candidates], generators);

            publish_public_key_share(this.public_key_share);
        }

        else if (type_of_vote === "approval"){
            var options = Array.apply(null, Array(candidates)).map(() => 2);

            //for this type of voting, we just want k votes of 2 or 1/2
            //where k is the number of candidates
            super(p, g, n, voter_id, options, bigInt(2));
        }

        else if (type_of_vote === "transferable"){

        }

        else if (type_of_vote === "point_distribution"){

        }
    }
}
*/
