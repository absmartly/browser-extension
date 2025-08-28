/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./src/components/ExtensionUI.tsx",
    "./tabs/sidebar.tsx",
    "./src/**/*.{ts,tsx}"
  ],
  plugins: []
}