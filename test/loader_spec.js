describe('setupModuleLoader', function() {
    beforeEach(function() {
        delete window.angular;
        setupModuleLoader(window);
    });

    it('exposes angular on the window', function() {
        var ng = window.angular;
        setupModuleLoader(window);
        expect(window.angular).toBe(ng);
    });

    it('attaches the requires array to the registered module', function() {
        setupModuleLoader(window);
        var myModule = window.angular.module('myModule', ['myOtherModule']);
        expect(myModule.requires).toEqual(['myOtherModule']);
    });

    it('allows getting a module', function() {
        var myModule = window.angular.module('myModule', []);
        var gotModule = window.angular.module('myModule');
        expect(gotModule).toBeDefined();
        expect(gotModule).toBe(myModule);
    });
});