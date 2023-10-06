<script setup>
import { ref, watch } from "vue";
import { supabase } from "./lib/supabaseClient";

let fieldUsedAsPrompt = ref("");
let fieldUsedAsAnswer = ref("");
let possibleAnswers = ref([]);
let prompt = ref("");
let answer = ref("");
let givenAnswer = ref("");
let indexOfAnswerClicked = ref(null);
const exercise = ref(null);
let exercisesDoneThisSession = 0;
let streak = ref(0);
const isRevealed = ref(false);
let exercises = [];

let randomNewSentence = {};

let mainSentencePracticeSet = [];

// if uid is not in localStorage, create one and save
let uid;
if (localStorage.getItem("uid")) {
  uid = localStorage.getItem("uid");
} else {
  uid = Math.random().toString(36).substring(2, 15);
  localStorage.setItem("uid", uid);
}

// EXERCISES IMPORTER FROM BACKEND
import data from "./clozes.json";

// for every main sentence, attach exercises that match the id of children
for (const exercise of data["exercises"]) {
  exercise.sr = {
    interval: 10,
    repetitions: 0,
    dueAt: Math.floor(new Date().getTime() / 1000),
  };
  exercise.practiceBucket = 0;
  exercise.stats = [];
  exercises.push(exercise);
}

console.log("Exercises after adapting", exercises);

// TODO: reintroduce localstorage load
// // see if sentencesBank is in localStorage, if so, load it,  if not, set it to the imported numbers (feel free to disable conditional for developing)
// if (localStorage.getItem("sentencesBank")) {
//   // if it is in localStorage, set the sentencesBank to the localStorage value
//   sentencesBank = JSON.parse(localStorage.getItem("sentencesBank"));
// }

// make every sentence two exercises: for one, from Arabic to English, for the other, from English to Arabic
// for (const sentence of sentencesBank) {
//   const exerciseArabicToEnglish = {
//     prompt: `${sentence.scr} \n (${sentence.trans})`,
//     answer: sentence.en,
//     sr: {
//       interval: 10,
//       repetitions: 0,
//       dueAt: Math.floor(new Date().getTime() / 1000),
//     },
//     stats: [],
//     parent: sentence,
//   };
//   const exerciseEnglishToArabic = {
//     prompt: sentence.en,
//     answer: `${sentence.scr} \n (${sentence.trans})`,
//     sr: {
//       interval: 10,
//       repetitions: 0,
//       dueAt: Math.floor(new Date().getTime() / 1000),
//     },
//     stats: [],
//     parent: sentence,
//   };
//   exercises.push(exerciseArabicToEnglish);
//   exercises.push(exerciseEnglishToArabic);
// }

// TODO: reintroduce the localstorage load
// // same for exercises
// if (localStorage.getItem("exercises")) {
//   // if it is in localStorage, set the sentencesBank to the localStorage value
//   exercises = JSON.parse(localStorage.getItem("exercises"));
// }

function setNewTopic() {
  // find a random new mainSentence
  const newSentences = data["main_sentences"].filter(
    (sentence) => sentence.isNew
  );
  randomNewSentence =
    newSentences[Math.floor(Math.random() * newSentences.length)];

  console.log("Picked Random New Sentence", randomNewSentence);
  pickSentenceExercise();
}

function pickSentenceExercise() {
  isRevealed.value = false;
  // pick an exercise from the current randomNewSentence exercise children with a bucket value of < 3
  const dueExercises = randomNewSentence.exercises.filter(
    (exercise) => exercise.practiceBucket < 3
  );
  const newExercise =
    dueExercises[Math.floor(Math.random() * dueExercises.length)];
  console.log("Picked New Exercise", newExercise);
  exercise.value = newExercise;
}

function getNextExercise() {
  isRevealed.value = false;
  let possibleExercises = exercises;

  // new exercises are those whose stats array is empty
  const newDueExercises = possibleExercises.filter(
    (exercise) => exercise.stats.length == 0
  );
  // also check if parent number is due (or due is null)
  const oldDueExercises = possibleExercises.filter(
    (exercise) =>
      exercise.stats.length > 0 &&
      exercise.sr.dueAt <= Math.floor(new Date().getTime() / 1000)
  );
  // in case there are no exercises due, make a popup and return
  if (newDueExercises.length == 0 && oldDueExercises.length == 0) {
    // alert("You have nothing left to do right now! Come back later!");
    return;
  }
  // pick an old exercise with 80% chance. But:
  // if there are no old exercises, always pick a new one
  // and if there are no new exercises, always pick an old one
  // also, the longer streak goes one, the likelier that we pick a new exercise
  const forNewExerciseMustBeLargerThan = Math.max(
    0.8 - streak.value * 0.03,
    0.1
  );
  let pickNewExercise =
    Math.random() > forNewExerciseMustBeLargerThan ||
    (oldDueExercises.length == 0 && newDueExercises.length > 0);
  // always pick the one that has been due the longest
  let newExercise = {};
  const randomIndex = Math.floor(Math.random() * 50);
  if (pickNewExercise) {
    // pick a new exercise
    newExercise = newDueExercises.sort((a, b) => a.sr.dueAt - b.sr.dueAt)[
      Math.min(randomIndex, newDueExercises.length - 1)
    ];
  } else {
    // pick an old exercise
    newExercise = oldDueExercises.sort((a, b) => a.sr.dueAt - b.sr.dueAt)[
      Math.min(randomIndex, oldDueExercises.length - 1)
    ];
  }
  exercise.value = newExercise;

  prompt.value = exercise.value.prompt;
  answer.value = exercise.value.answer;
}

getNextExercise();

function userSawExerciseBefore() {
  return exercise.value.stats.length > 0;
}

async function handleAnswer(rating) {
  exercisesDoneThisSession++;

  // if answer correct, double interval, if incorrect, half interval (minimum 10)
  if (rating) {
    streak.value++;

    exercise.value.sr.repetitions++;
    exercise.value.sr.interval =
      exercise.value.sr.interval * 2 * exercise.value.sr.repetitions;
    // if the repetition before this one was more than 16h ago, set the interval to at least 16h
    if (
      exercise.value.stats.length > 1 &&
      exercise.value.stats[exercise.value.stats.length - 2].timestamp <
        Math.floor(new Date().getTime() / 1000) - 16 * 60 * 60
    ) {
      exercise.value.sr.interval = Math.max(
        exercise.value.sr.interval,
        16 * 60 * 60
      );
    }
  } else {
    streak.value = 0;

    exercise.value.sr.repetitions = 0;
    // divide level by 2 and round down
  }

  // set dueAt to now + interval
  exercise.value.sr.dueAt =
    Math.floor(new Date().getTime() / 1000) + exercise.value.sr.interval;
  const statsObj = {
    guessWasCorrect: rating,
    guess: answer,
    answer: answer.value,
    prompt: prompt,
    promptType: fieldUsedAsPrompt.value,
    answerType: fieldUsedAsAnswer.value,
    timestamp: Math.floor(new Date().getTime() / 1000),
  };
  exercise.value.stats.push(statsObj);
  // save the sentencesBank and exercises to localStorage
  localStorage.setItem("exercises", JSON.stringify(exercises));
  // TODO: make its own supabase
  // try {
  //   const { data, error } = await supabase.from("learning_data").insert([
  //     {
  //       user_uid: uid,
  //       learning_result: JSON.stringify(statsObj),
  //     },
  //   ]);
  // } catch (error) {
  //   console.error(error);
  // }
}
</script>

<template>
  <main class="p-2 flex flex-col items-center">
    <div class="flex gap-2">
      <button class="btn btn-success btn-disabled">
        Practice Previous Exercises
      </button>
      <button class="btn btn-primary" @click="setNewTopic">
        Learn New Sentence
      </button>
    </div>
    <!-- {{ exercise }} -->
    <div
      class="card bg-gray-600 shadow-xl m-4 p-4 flex flex-col justify-start items-center min-w-sm max-w-screen-xl"
      v-if="exercise"
      style="min-height: 390px"
    >
      <div id="prompt" class="p-2">
        {{ exercise.prompt }}
      </div>
      <div class="mt-2">
        {{ exercise.sentence_en }}
      </div>
      <div class="text-3xl p-2">
        {{ exercise.question }}
      </div>

      <div
        class="w-full text-center bg-green-700 mt-2 p-2 text-3xl"
        v-if="isRevealed"
      >
        {{ exercise.sentence_ar }}
      </div>
      <!-- randomly shuffle order of answer buttons whenever new exercise is picked, using flex reverse -->
      <div
        class="card-actions gap-2 mt-6 pt-2"
        v-if="!isRevealed"
        :class="Math.random() > 0.5 ? 'flex-row-reverse' : 'flex-row'"
        :key="exercise"
      >
        <button class="btn text-3xl" @click="isRevealed = true; handleAnswer(true)">
          {{ exercise.correct_answer }}
        </button>
        <button class="btn text-3xl" @click="isRevealed = true; handleAnswer(false)">
          {{ exercise.wrong_answer }}
        </button>
      </div>
      <div class="card-actions gap-2 mt-6 pt-2" v-else>
        <button class="btn" @click="getNextExercise">Show Next</button>
      </div>
      <!-- <div
        class="card-actions flex-col justify-center mt-6 pt-2"
        v-if="!isRevealed"
      >
        <button
          class="btn btn-primary mt-4 self-end"
          @click="isRevealed = true"
        >
          Reveal
        </button>
      </div> -->
      <!-- <div class="card-actions flex justify-center gap-2 mt-6 pt-2" v-else>
        <button class="btn btn-error" @click="handleAnswer(false)">
          Wrong
        </button>
        <button class="btn btn-success" @click="handleAnswer(true)">
          Correct
        </button>
      </div> -->
    </div>
  </main>

  <footer class="border-t-2 mt-10 w-full p-4 text-sm">
    <ul class="flex flex-col gap-2">
      <li>Transliterations are Egyptian Arabic.</li>
      <li>
        Made by
        <a class="underline" href="hello@koljapluemer.com">Kolja Sam Pluemer</a
        >.
      </li>
      <li>
        Pseudonymous learning is transmitted to improve the app. No personal
        data leaves your device.
      </li>
      <li>
        you may also enjoy:
        <a
          class="underline"
          href="https://arabic-pronounciation.koljapluemer.com/"
          >Arabic Pronunciation Tutor (WIP)</a
        >.
      </li>
      <li>
        More cool stuff at
        <a class="underline" href="https://koljapluemer.com/"
          >koljapluemer.com</a
        >.
      </li>
    </ul>
  </footer>
</template>

<style scoped></style>
