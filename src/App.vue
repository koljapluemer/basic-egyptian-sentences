<script setup>
import Game from "./components/Game.vue";
import { Mail, ExternalLink } from "lucide-vue-next";
</script>

<template>
  <main class="flex-1 flex flex-col gap-4 items-center justify-center w-full">
    <Game />
  </main>

  <footer class="glass border border-base-200/60 rounded-2xl shadow p-4 w-full">
    <p>
      Made by
      <a class="link" href="https://koljapluemer.com/">Kolja Sam Pluemer</a>.
      <a href="mailto:feedback@koljapluemer.com" class="link inline-flex items-center gap-1">
        Send feedback here
        <Mail class="w-3 h-3" />
      </a>.
    </p>

    <p class="text-base-content/90">
      No personal data leaves your device. Cookies store progress locally.
    </p>
  </footer>
</template>

<style>
html {
  background-image: url("@/assets/bg.webp");
  background-size: cover;
  background-attachment: fixed;
}
</style>
