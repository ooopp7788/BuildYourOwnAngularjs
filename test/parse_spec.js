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

    it("can parse a string in single quotes", function() {
        var fn = parse('"abc"');
        expect(fn()).toEqual('abc');
    });
    it("can parse a string in double quotes", function() {
        var fn = parse("'abc'");
        expect(fn()).toEqual('abc');
    });

    it("will parse an empty array", function() {
        var fn = parse('[]');
        expect(fn()).toEqual([]);
    });

    it("will parse an empty object", function() {
        var fn = parse('{}');
        expect(fn()).toEqual({});
    });

    it("will parse a non-empty object", function() {
        var fn = parse('{"akey": 1,\'another-key\': 2}');
        expect(fn()).toEqual({ 'akey': 1, 'another-key': 2 });
    });
});