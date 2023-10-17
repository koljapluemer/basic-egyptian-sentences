<script setup>
import { ref, watch, computed } from "vue";
import { supabase } from "./lib/supabaseClient";
// bar chart
import BarChart from "./components/BarChart.vue";

const exercise = ref(null);
const exercisesDoneThisSession = ref(0);
const practiceExercisesDoneThisSession = ref(0);
let streak = ref(0);
const isRevealed = ref(false);
let exercises = [];
const lastAnswerWasCorrect = ref(false);

const gameMode = ref("undetermined");
const currentlyPracticedSentence = ref(null);
let exercisesInLessonCounter = 0;

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

for (const exercise of data["exercises"]) {
  exercise.sr = {
    repetitions: 0,
    interval: 10,
    due: Math.floor(new Date().getTime() / 1000),
  };
  exercise.practiceBucket = 0;
  exercise.stats = [];
  exercises.push(exercise);
}
console.log("exercises", exercises);

// TODObut, implement: new exercises should be included, and deleted should be deleted
if (localStorage.getItem("exercises")) {
  const exercisesFromStore = JSON.parse(localStorage.getItem("exercises"));
  const exercisesFromJSON = exercises;
  exercises = exercisesFromStore;
  // if there are new exercises in the JSON (in case backend got updated), add them to the exercises array
  // find match by 'sentence_en' property
  for (const exercise of exercisesFromJSON) {
    if (
      !exercisesFromStore
        .map((e) => e.sentence_en)
        .includes(exercise.sentence_en)
    ) {
      console.log("adding new exercise", exercise);
      exercises.push(exercise);
    }
  }
}

function getNextExercise() {
  exercisesInLessonCounter++;

  isRevealed.value = false;
  let possibleExercises = exercises.filter(
    (exercise) => exercise.sr.due <= Math.floor(new Date().getTime() / 1000)
  );
  if (possibleExercises.length == 0) {
    alert("You have absolutely nothing to practice right now. Good job.");
    return;
  }
  exercise.value = possibleExercises[
    Math.floor(Math.random() * possibleExercises.length)
  ];
}

function userSawExerciseBefore() {
  return exercise.value.stats.length > 0;
}
async function handleAnswer(rating) {
  exercisesDoneThisSession.value++;
  lastAnswerWasCorrect.value = rating;

  // Usual naive SR
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

  // set due to now + interval
  exercise.value.sr.due =
    Math.floor(new Date().getTime() / 1000) + exercise.value.sr.interval;
  const statsObj = {
    guessWasCorrect: rating,
    timestamp: Math.floor(new Date().getTime() / 1000),
    exercise: exercise.question,
    answer_options: [exercise.correct_answer, exercise.wrong_answer],
  };
  exercise.value.stats.push(statsObj);
  // save the sentencesBank and exercises to localStorage
  localStorage.setItem("exercises", JSON.stringify(exercises));
  try {
    console.log("saving to supabase");
    const { data, error } = await supabase
      .from("learning_data_cloze_sentences")
      .insert([
        {
          user_uid: uid,
          learning_result: JSON.stringify(statsObj),
        },
      ]);
  } catch (error) {
    console.error(error);
  }
}

function setGameMode(mode) {
  gameMode.value = mode;
  exercisesDoneThisSession.value = 0;
  console.log("gameMode", gameMode.value);
  getNextExercise();
}

</script>

<template>
  <main class="p-2 flex flex-col items-center flex-grow justify-center">
    <div v-if="gameMode == 'undetermined'">
      <div class="flex gap-2 flex-wrap justify-center">
      
        <button
          class="btn btn-primary flex-grow flex flex-col btn-primary"
          @click="setGameMode('go')"
        >
          Start Practice Session
        </button>
      </div>
    </div>
    <div
      class="card bg-gray-600 shadow-xl my-4 p-4 flex flex-col justify-start items-center min-w-sm max-w-screen-xl"
      v-else
      v-if="exercise"
      style="min-height: 390px"
    >
      <div id="prompt" class="p-2">
        {{ exercise.prompt }}
      </div>
      <div class="mt-2"></div>
      <div class="p-2"></div>

      <div class="flex w-full">
        <!-- randomly choose between p1, p2, p3, p4 -->
        <!-- do this with a modulo 4 operation on the exercise english length -->
        <div class="flex flex-col items-center">
          <img
            src="@/assets/p1.svg"
            alt="Avatar"
            class="w-10"
            v-if="exercise.sentence_en.length % 4 == 0"
          />
          <img
            src="@/assets/p2.svg"
            alt="Avatar"
            class="w-10"
            v-else-if="exercise.sentence_en.length % 4 == 1"
          />
          <img
            src="@/assets/p3.svg"
            alt="Avatar"
            class="w-10"
            v-else-if="exercise.sentence_en.length % 4 == 2"
          />
          <img
            src="@/assets/p4.svg"
            alt="Avatar"
            class="w-10"
            v-else-if="exercise.sentence_en.length % 4 == 3"
          />

  
        </div>

        <div class="chat chat-start flex-grow w-full">
          <!-- make green if revealed and isCorrect, otherwise if revealed set red -->
          <div
            class="chat-bubble w-full"
            :class="
              isRevealed
                ? lastAnswerWasCorrect
                  ? 'chat-bubble-success'
                  : 'chat-bubble-error'
                : 'chat-bubble-primary'
            "
          >
            <small class="mb-4" v-if="isRevealed">{{
              exercise.transliteration
            }}</small>
            <br />

            <span class="text-3xl" v-if="!isRevealed">
              {{ exercise.question }}
            </span>
            <span class="text-3xl" v-else>
              {{ exercise.sentence_ar }}
            </span>
            <br />
            <small> ({{ exercise.sentence_en }}) </small>
          </div>
        </div>
      </div>

      <!-- randomly shuffle order of answer buttons whenever new exercise is picked, using flex reverse -->
      <div
        class="card-actions gap-2 mt-6 pt-2"
        v-if="!isRevealed"
        :class="Math.random() > 0.5 ? 'flex-row-reverse' : 'flex-row'"
        :key="exercise"
      >
        <button
          class="btn text-3xl"
          @click="
            isRevealed = true;
            handleAnswer(true);
          "
        >
          {{ exercise.correct_answer }}
        </button>
        <button
          class="btn text-3xl"
          @click="
            isRevealed = true;
            handleAnswer(false);
          "
        >
          {{ exercise.wrong_answer }}
        </button>
      </div>
      <div class="card-actions gap-2 mt-6 pt-2" v-else>
        <button class="btn" @click="getNextExercise">Show Next</button>
      </div>
    </div>
    <article v-if="false">
      <BarChart
        class="chart"
        :data-set="[0, 1]"
        :margin-left="40"
        :margin-top="40"
        :tick-count="5"
        :bar-padding="0.5"
      />
    </article>
  </main>

  <footer class="border-t-2 mt-10 w-full p-4 text-sm">
    <ul class="flex flex-col gap-2">
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
