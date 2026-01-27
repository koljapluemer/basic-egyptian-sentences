<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { createToaster } from "@meforma/vue-toaster"
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
const progressStyle = computed(() => ({
  width: `${(1 - currentTime.value / totalTime.value) * 100}%`,
}))

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

// Generate exercise
function generateExercise() {
  if (sentences.value.length === 0) return

  // Pick random sentence
  const randomIndex = Math.floor(Math.random() * sentences.value.length)
  currentSentence.value = sentences.value[randomIndex]

  // Pick random usable part
  const usableParts = getUsableParts(currentSentence.value)
  currentPart.value = usableParts[Math.floor(Math.random() * usableParts.length)]

  // Find wrong answer: pick from 3 closest words by Levenshtein
  const closest = findClosestWords(currentPart.value, words.value, 3)
  wrongAnswer.value = closest[Math.floor(Math.random() * closest.length)] || words.value[0]
}

// Build card rows for display
const cardRows = computed<IndexCardRow[]>(() => {
  if (!currentSentence.value) return []

  if (!isRevealed.value) {
    // Front: Arabic with placeholder, divider, English
    const maskedArabic = currentSentence.value.arz.replace(
      currentPart.value,
      '<span class="inline-block bg-primary/30 rounded px-2 mx-1 min-w-[3rem]">&nbsp;&nbsp;&nbsp;</span>'
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
      `<span class="bg-primary/30 rounded px-1">${currentPart.value}</span>`
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

    // Check for top 10 entry
    if (highscores.value.length < 10) {
      toaster.success("New Top 10 Entry!")
    } else if (score.value > highscores.value[9].score) {
      toaster.success("New Top 10 Entry!")
    }

    // Check for personal best
    if (highscores.value.length === 0 || score.value > highscores.value[0].score) {
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
  <div v-if="gameMode === 'undetermined'">
    <h1 class="font-bold text-5xl m-4">Basic Egyptian Sentences Game</h1>
    <div class="card glass m-2">
      <div class="card-body flex gap-2 flex-wrap justify-center">
        <h2 class="card-title">
          Practice your survival Arabic and get ready for Egypt.
        </h2>
        <button
          class="btn btn-primary flex-grow flex flex-col"
          @click="setGameMode('go')"
        >
          Start Game
        </button>
      </div>
    </div>

    <div class="card glass m-2" v-if="lastScore">
      <div class="card-body">
        <h2 class="card-title">You scored: {{ lastScore }} points.</h2>
      </div>
    </div>

    <div class="card glass m-2">
      <div class="card-body">
        <h2 class="card-title">Personal Highscores</h2>
        <ol class="list-decimal">
          <li
            v-for="(highscore, index) in sortedHighscores().slice(0, 10)"
            :key="index"
            class="flex gap-4 w-full justify-between"
          >
            <span class="font-bold">{{ highscore.score }}</span>
            <span>
              {{
                new Date(highscore.date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}
            </span>
          </li>
        </ol>
      </div>
    </div>
  </div>

  <div v-else-if="gameMode === 'go'">
    <div class="card m-2 glass">
      <div class="card-body">
        <h2 class="card-title">Score: {{ score }}</h2>
        <div class="countdown-timer">
          <div class="progress-bar">
            <div class="progress" :style="progressStyle"></div>
          </div>
          <p>Time Remaining: {{ Math.round(remainingTime) }}s</p>
        </div>
      </div>
    </div>

    <div class="card m-2 glass" v-if="currentSentence" style="min-height: 390px">
      <div class="card-body">
        <IndexCard :rows="cardRows" />

        <div
          class="card-actions gap-2 mt-6 pt-2 flex"
          v-if="!isRevealed"
          :class="isReverseOrder ? 'flex-row-reverse' : 'flex-row'"
        >
          <button
            class="btn text-2xl flex-grow"
            dir="rtl"
            @click="handleAnswer(true)"
          >
            {{ currentPart }}
          </button>
          <button
            class="btn text-2xl flex-grow"
            dir="rtl"
            @click="handleAnswer(false)"
          >
            {{ wrongAnswer }}
          </button>
        </div>
        <div class="card-actions gap-2 mt-6 pt-2 flex" v-else>
          <button class="btn flex-grow fill-button" @click="getNextExercise">
            Show Next
          </button>
        </div>
      </div>
      <p class="p-4">
        The sentences are sourced from
        <a target="_blank" class="underline" href="https://eu.lisaanmasry.org/online/example.php">lisaanmasry.org</a>.
        This material is Copyright © 2007-2020 Mike Green.
      </p>
    </div>
  </div>
</template>

<style scoped>
.fill-button {
  background: linear-gradient(to right, #641ae6 50%, transparent 0);
  background-size: 200% 100%;
  background-position: right;
  animation: makeItfadeIn 5s 0s forwards linear;
}

@keyframes makeItfadeIn {
  100% {
    background-position: left;
  }
}

.countdown-timer {
  text-align: center;
}

.progress-bar {
  width: 100%;
  background-color: #ccc;
  height: 20px;
  position: relative;
  border-radius: 12px;
}

.progress-bar div {
  height: 100%;
  background-color: #4caf50;
  transition: width 1s linear;
}
</style>
