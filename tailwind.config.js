/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./src/components/ExtensionUI.tsx",
    "./content.tsx",
    "./src/**/*.{ts,tsx}"
  ],
  plugins: []
}