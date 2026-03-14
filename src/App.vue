<script setup>
import Game from "./components/Game.vue";
</script>

<template>
  <main class="flex-1 flex flex-col gap-4 items-center justify-center w-full">
    <Game />
  </main>

  <footer class="glass border border-base-200/60 rounded-2xl shadow p-4 w-full">
    <p>
      Made by
      <a class="link" href="https://koljasam.com/" target="_blank">Kolja Sam</a>.
    </p>

    <p class="text-base-content/90">
      No personal data leaves your device. Cookies store progress locally.
    </p>

    <p>If this app taught you something, you may want to <a href="https://ko-fi.com/S6S81CWUVD" target="_blank"
        rel="noopener" class="link">
        buy me a coffee
      </a>.</p>
  </footer>
</template>

<style>
html {
  background-image: url("@/assets/bg.webp");
  background-size: cover;
  background-attachment: fixed;
}
</style>
