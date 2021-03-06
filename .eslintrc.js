module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true,
        mocha: true
    },
    extends: "eslint:recommended",
    globals: {
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
        artifacts: true,
        contract: true,
        assert: true,
        web3: true,
        expect: true,
        expectAsync: true,
        beforeEach: true,
        jasmine: true
    },
    parserOptions: {
        ecmaVersion: 2018
    },
    rules: {
        indent: [
            "error",
            4,
            {"SwitchCase": 1}
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        quotes: [
            "error",
            "double"
        ],
        semi: [
            "error",
            "always"
        ]
    }
};