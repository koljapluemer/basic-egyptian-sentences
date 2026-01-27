<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { createToaster } from "@meforma/vue-toaster"
import { Play, Trophy, Timer, ArrowLeft, ArrowRight, CornerDownLeft, ExternalLink } from "lucide-vue-next"
import IndexCard from "./IndexCard.vue"
import type { IndexCardRow, Sentence } from "./types"
import { findClosestWords } from "@/utils/stringDistance"

const toaster = createToaster({
  position: "top-right",
})

// Game state
const gameMode = ref<"undetermined" | "go" | "game-ended">("undetermined")
const isRevealed = ref(false)
const lastAnswerWasCorrect = ref(false)
const streak = ref(0)
const incorrectAnswerCounter = ref(0)
const score = ref(0)
const lastScore = ref<number | null>(null)
const isReverseOrder = ref(false)
const timeoutId = ref<number | null>(null)

// Data
const sentences = ref<Sentence[]>([])
const words = ref<string[]>([])
const wordSet = ref<Set<string>>(new Set())
const currentSentence = ref<Sentence | null>(null)
const currentPart = ref<string>("")
const wrongAnswer = ref<string>("")

// Timer
const totalTime = ref(60)
const currentTime = ref(0)
const timerRunning = ref(false)
const timer = ref<number | null>(null)

// Highscores
const highscores = ref<{ score: number; date: string }[]>([])
if (localStorage.getItem("highscores")) {
  highscores.value = JSON.parse(localStorage.getItem("highscores")!)
}

// Computed
const remainingTime = computed(() => totalTime.value - currentTime.value)
const progressPercent = computed(() => (1 - currentTime.value / totalTime.value) * 100)

// Load data from public folder
async function loadData() {
  const [sentencesRes, wordsRes] = await Promise.all([
    fetch("/lisaanmasry_sentences.jsonl").then((r) => r.text()),
    fetch("/lisaanmasry_words.txt").then((r) => r.text()),
  ])

  // Parse words list and build lookup set
  words.value = wordsRes
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => w && !w.startsWith("ـ"))
  wordSet.value = new Set(words.value)

  // Parse JSONL
  const parsedSentences: Sentence[] = sentencesRes
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))

  // Filter sentences that have at least one word in the wordlist
  sentences.value = parsedSentences.filter((s) =>
    getUsableParts(s).length > 0
  )
}

// Get usable parts: split by whitespace, keep only words in wordlist
function getUsableParts(sentence: Sentence): string[] {
  return sentence.arz.split(/\s+/).filter((word) => wordSet.value.has(word))
}

function normalizeForCompare(value: string): string {
  return value
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "")
    .replace(/[\p{P}]/gu, "")
    .trim()
}

// Generate exercise
function generateExercise() {
  if (sentences.value.length === 0) return

  // Pick random sentence
  const randomIndex = Math.floor(Math.random() * sentences.value.length)
  currentSentence.value = sentences.value[randomIndex]

  // Pick random usable part
  const usableParts = getUsableParts(currentSentence.value)
  currentPart.value = usableParts[Math.floor(Math.random() * usableParts.length)]

  // Find wrong answer: pick from 3 closest words by Levenshtein,
  // but exclude options that only differ by diacritics.
  const basePart = normalizeForCompare(currentPart.value)
  const closest = findClosestWords(currentPart.value, words.value, 3)
  const filtered = closest.filter((word) => normalizeForCompare(word) !== basePart)
  const pool = filtered.length
    ? filtered
    : words.value.filter((word) => normalizeForCompare(word) !== basePart)
  wrongAnswer.value = pool[Math.floor(Math.random() * pool.length)] || words.value[0]
}

// Build card rows for display
const cardRows = computed<IndexCardRow[]>(() => {
  if (!currentSentence.value) return []

  if (!isRevealed.value) {
    // Front: Arabic with placeholder, divider, English
    const maskedArabic = currentSentence.value.arz.replace(
      currentPart.value,
      '<span class="inline-block bg-base-200/70 border border-base-300/60 rounded px-2 mx-1 min-w-[3rem]">&nbsp;&nbsp;&nbsp;</span>'
    )
    const translation = currentSentence.value.translations[0]?.replace("eng:", "") || ""

    return [
      { type: "text", text: maskedArabic, size: "auto", rtl: true },
      { type: "divider" },
      { type: "text", text: translation, size: "small" },
    ]
  } else {
    // Revealed: Full Arabic with highlight, divider, transliteration, English
    const highlightedArabic = currentSentence.value.arz.replace(
      currentPart.value,
      `<span class="bg-base-200/70 border border-base-300/60 rounded px-1">${currentPart.value}</span>`
    )
    const translation = currentSentence.value.translations[0]?.replace("eng:", "") || ""

    return [
      { type: "text", text: highlightedArabic, size: "auto", rtl: true },
      { type: "divider" },
      { type: "text", text: currentSentence.value.transliteration, size: "small" },
      { type: "text", text: translation, size: "small" },
    ]
  }
})

function getNextExercise() {
  if (timeoutId.value) {
    clearTimeout(timeoutId.value)
  }

  // Check if time is up
  if (currentTime.value >= totalTime.value) {
    timerRunning.value = false
    toaster.info("Time's up!")
    setGameMode("game-ended")
    return
  }

  isReverseOrder.value = Math.random() < 0.5
  isRevealed.value = false
  generateExercise()
  timerRunning.value = true
}

function moveToNextExercise() {
  if (isRevealed.value) {
    getNextExercise()
  }
}

function handleAnswer(isCorrect: boolean) {
  if (gameMode.value !== "go" || isRevealed.value) return

  timerRunning.value = false
  isRevealed.value = true
  lastAnswerWasCorrect.value = isCorrect

  // Auto-advance after 5 seconds
  timeoutId.value = window.setTimeout(() => {
    moveToNextExercise()
  }, 5000)

  if (isCorrect) {
    streak.value++
    currentTime.value -= 5
    toaster.success(`+5 seconds`)
    const pointsToAdd = 10 + streak.value * 2
    score.value += pointsToAdd
    toaster.success(`+${pointsToAdd}`)
  } else {
    streak.value = 0
    incorrectAnswerCounter.value++
    const addToTime = 2 * incorrectAnswerCounter.value + 1
    currentTime.value += addToTime
    toaster.error(`-${addToTime} seconds`)
  }
}

function setGameMode(mode: "undetermined" | "go" | "game-ended") {
  if (mode === gameMode.value) return

  gameMode.value = mode

  if (mode === "go") {
    score.value = 0
    currentTime.value = 0
    totalTime.value = 60
    streak.value = 0
    incorrectAnswerCounter.value = 0
    startTimer()
    getNextExercise()
  } else if (mode === "game-ended") {
    lastScore.value = score.value

    const bestScore = highscores.value.length
      ? Math.max(...highscores.value.map((entry) => entry.score))
      : null

    // Check for top 10 entry
    if (highscores.value.length < 10) {
      toaster.success("New Top 10 Entry!")
    } else if (score.value > highscores.value[9].score) {
      toaster.success("New Top 10 Entry!")
    }

    // Check for personal best
    if (bestScore === null || score.value > bestScore) {
      toaster.success("New Personal Best!")
    }

    // Save highscore
    highscores.value.push({
      score: score.value,
      date: new Date().toISOString(),
    })
    localStorage.setItem("highscores", JSON.stringify(highscores.value))
    setGameMode("undetermined")
  }
}

function sortedHighscores() {
  return [...highscores.value].sort((a, b) => b.score - a.score)
}

function startTimer() {
  timerRunning.value = true
  if (timer.value) clearInterval(timer.value)
  timer.value = window.setInterval(updateTime, 1000)
}

function updateTime() {
  if (timerRunning.value) {
    currentTime.value += 1
  }
}

// Keyboard navigation
onMounted(async () => {
  await loadData()

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      if (gameMode.value === "go" && !isRevealed.value) {
        handleAnswer(!isReverseOrder.value)
      }
    } else if (e.key === "ArrowRight") {
      if (gameMode.value === "go" && !isRevealed.value) {
        handleAnswer(isReverseOrder.value)
      }
    } else if (e.key === "Enter") {
      if (gameMode.value === "go" && isRevealed.value) {
        getNextExercise()
        return
      }
      if (gameMode.value === "undetermined") {
        setGameMode("go")
      }
    }
  })
})
</script>

<template>
  <!-- Menu Screen -->
  <template v-if="gameMode === 'undetermined'">
    <div class="glass border border-base-200/60 rounded-2xl shadow p-4 w-full">
      <h1 class="font-bold text-4xl text-center text-base-content ">
        Basic Egyptian Sentences
      </h1>
    </div>

    <div class="glass border border-base-200/60 rounded-2xl shadow flex flex-col gap-4 p-4 items-center w-full">
      <p class="text-center text-base-content/90">
        Practice your survival Arabic and get ready for Egypt.
      </p>
      <div class="flex flex-col gap-2 items-center">
        <button class="btn btn-lg w-full gap-2" @click="setGameMode('go')">
          <Play class="w-5 h-5" />
          Start Game
        </button>
        <kbd class="kbd kbd-sm inline-flex items-center gap-1 glass">
          <CornerDownLeft class="w-3 h-3" />Enter
        </kbd>
      </div>
    </div>

    <div class="glass border border-base-200/60 rounded-2xl shadow  p-4 w-full" v-if="lastScore">
      <p class="text-center text-lg">
        You scored <span class="font-bold">{{ lastScore }}</span> points
      </p>
    </div>

    <div class="glass border border-base-200/60 rounded-2xl shadow  p-4 w-full grid gap-3 p-6"
      v-if="sortedHighscores().length">
      <h2 class="font-semibold flex items-center gap-2">
        <Trophy class="w-5 h-5" />
        Highscore
      </h2>
      <ol class="grid gap-1">
        <li v-for="(highscore, index) in sortedHighscores().slice(0, 10)" :key="index" class="flex justify-between">
          <span class="font-medium">{{ highscore.score }}</span>
          <span class="text-base-content/90">
            {{
              new Date(highscore.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            }}
          </span>
        </li>
      </ol>
    </div>
  </template>

  <!-- Game Screen -->
  <template v-else-if="gameMode === 'go'">
    <div class="glass border border-base-200/60 rounded-2xl shadow grid gap-2 p-4 w-full">
      <div class="flex justify-between items-center">
        <span class="font-bold text-lg">{{ score }}</span>
        <span class="flex items-center gap-1 text-base-content/90">
          <Timer class="w-4 h-4" />
          {{ Math.round(remainingTime) }}s
        </span>
      </div>
      <div class="w-full glass rounded-full h-2 overflow-hidden">
        <div class="h-full bg-base-content/60 transition-all duration-1000 ease-linear rounded-full"
          :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>

    <div class="glass border border-base-200/60 rounded-2xl shadow grid gap-6 p-6 w-full" v-if="currentSentence">
      <IndexCard :rows="cardRows" />

      <div class="flex gap-4" v-if="!isRevealed" :class="isReverseOrder ? 'flex-row-reverse' : 'flex-row'">
        <div class="flex-1 grid gap-2">
          <button class="btn btn-lg w-full text-xl" dir="rtl" @click="handleAnswer(true)">
            {{ currentPart }}
          </button>
          <div class="flex justify-center">
            <kbd class="kbd kbd-sm glass bg-base-100/70 border border-base-200/60 inline-flex items-center gap-1"
              v-if="!isReverseOrder">
              <ArrowLeft class="w-3 h-3" />
            </kbd>
            <kbd class="kbd kbd-sm glass bg-base-100/70 border border-base-200/60 inline-flex items-center gap-1"
              v-else>
              <ArrowRight class="w-3 h-3" />
            </kbd>
          </div>
        </div>
        <div class="flex-1 grid gap-2">
          <button class="btn btn-lg w-full text-xl" dir="rtl" @click="handleAnswer(false)">
            {{ wrongAnswer }}
          </button>
          <div class="flex justify-center">
            <kbd class="kbd kbd-sm glass bg-base-100/70 border border-base-200/60 inline-flex items-center gap-1"
              v-if="isReverseOrder">
              <ArrowLeft class="w-3 h-3" />
            </kbd>
            <kbd class="kbd kbd-sm glass bg-base-100/70 border border-base-200/60 inline-flex items-center gap-1"
              v-else>
              <ArrowRight class="w-3 h-3" />
            </kbd>
          </div>
        </div>
      </div>

      <div v-else class="grid gap-2">
        <button class="btn btn-lg w-full bg-base-100 text-base-content border border-base-200 fill-button"
          @click="getNextExercise">
          Continue
        </button>
        <div class="flex justify-center">
          <kbd class="kbd kbd-sm glass bg-base-100/70 border border-base-200/60 inline-flex items-center gap-1">
            <CornerDownLeft class="w-3 h-3" />
            Enter
          </kbd>
        </div>
      </div>

      <p class="text-center text-base-content/90">
        Sentences from
        <a target="_blank" class="link inline-flex items-center gap-1"
          href="https://eu.lisaanmasry.org/online/example.php">
          lisaanmasry.org
          <ExternalLink class="w-3 h-3" />
        </a>. This material is Copyright © 2007-2020 Mike Green; this is non-commercial use as by the license.
      </p>
    </div>
  </template>
</template>

<style scoped>
.fill-button {
  background: linear-gradient(to right, rgba(255, 255, 255, 0.3) 50%, transparent 0);
  background-size: 200% 100%;
  background-position: right;
  animation: fillProgress 5s forwards linear;
}

@keyframes fillProgress {
  100% {
    background-position: left;
  }
}
</style>
