# project-igroup
project-igroup created by GitHub Classroom

## Crypto stuff

### Contribute
Install TypeScript:
```
$ npm install -g typescript
```

Make your changes in `crypto/vote.ts`. Then do:
```
$ cd crypto
$ tsc vote.ts
```

This will compile the TypeScript into JS and replace the file `vote.js`.

### Useful links
Heavily based on this paper: [A Secure and Optimally Efficient Multi-Authority Election Scheme](http://www.win.tue.nl/~berry/papers/euro97.pdf).

Also borrowing a bit from this paper: [Electronic Voting Schemes](http://bezadis.ics.upjs.sk/old/files/other/rjaskova.pdf).

Added help from [this Crypto SE answer](http://crypto.stackexchange.com/questions/3474/approach-towards-anonymous-e-voting/3554#3554).

[Lots of type definitions for TypeScript](https://github.com/DefinitelyTyped/DefinitelyTyped)

[The BigInteger library I started using](https://github.com/peterolson/BigInteger.js)

### Technique
The first layer is a set of JS crypto functions which do the heavy lifting for the math of the crypto. These functions depend on BigInteger.js, a library which allows us to use arbitrary size integers. They also depend on jssha256.js, which allows us to compute the SHA256 hash of a hex number. This hash is used for the "challenge" in zero knowledge proofs. Instead of each voter first sending out a commit, then receiving a challenge, and finally submitting their proof, they instead just do `sha256( unique_id | commit)` and use the output as their challenge. This allows voters to do "proofs" in a non-interactive way, greatly reducing complexity and network costs. Because voters have no control over their `unique_id`, unless they can do something sneaky like find collisions in SHA2, this makes this process the same as a random challenge (and simultaneously defeats the malicious verifier).

These crypto JS functions are then placed in a web worker. The web worker is then called from another script which uses socket.io to communicate with the server. The web worker is needed because otherwise the entire page will freeze when we do the crypto, which is quite CPU intensive.

The second layer, which has the socket.io functions, communicates with both the web worker and the server to coordinate the vote.
