/* jshint globalstrict: true */
/* global parse: false */
'use strict';

describe("parse", function() {
    it("can parse number、sicence number", function() {
        var fn = parse('42e-2');
        var intFn = parse('123');
        var t = parse('2e-1');
        expect(fn()).toBe(0.42);
        expect(intFn()).toBe(123);
    });
});