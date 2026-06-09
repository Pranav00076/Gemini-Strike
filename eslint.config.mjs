import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import globals from "globals";
import js from "@eslint/js";

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  js.configs.recommended,
  firebaseRulesPlugin.configs['flat/recommended']
];
