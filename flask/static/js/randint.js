function randint(r) {
    var base = bigInt(32);
    var random = bigInt(0);
    var i = 0;


    var random32 = new Uint32Array(1);
    self.crypto.getRandomValues(random32);

    while(base.pow(i).lesser(r)){
        random = random.add(bigInt(random32[0]).shiftLeft(i * 32));
        self.crypto.getRandomValues(random32);
        i += 1;
    }

    return random;
}
