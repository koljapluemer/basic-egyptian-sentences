<script setup>
import { ref, watch, computed } from "vue";
import { supabase } from "./lib/supabaseClient";

const studyMSA = ref(true);
const studyEgyptian = ref(true);

const exercise = ref(null);
const exercisesDoneThisSession = ref(0);
const practiceExercisesDoneThisSession = ref(0);
let streak = ref(0);
const isRevealed = ref(false);
let exercises = [];
const lastAnswerWasCorrect = ref(false);

const gameMode = ref("undetermined");
const currentlyPracticedSentence = ref(null);

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

function setGameMode(mode) {
  gameMode.value = mode;
  if (mode == "practice") {
    practiceExercisesDoneThisSession.value = 0;
    getNextExercise();
  } else if (mode == "new") {
    // find a random exercise that has not been practiced yet (stats length 0)
    const newExercise = exercises.filter(
      (exercise) => exercise.stats.length == 0
    )[Math.floor(Math.random() * exercises.length)];
    currentlyPracticedSentence.value = newExercise.sentence_en;
    getNextExercise();
  }
}

function getNextExercise() {
  isRevealed.value = false;
  let possibleExercises = exercises;

  // filter out exercises that are not in the currently selected dialects
  if (!studyMSA.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "MSA"
    );
  }
  if (!studyEgyptian.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "Egyptian"
    );
  }

  if (gameMode.value == "practice") {
    // also check if parent number is due (or due is null)
    const oldDueExercises = possibleExercises.filter(
      (exercise) =>
        exercise.stats.length > 0 &&
        exercise.sr.dueAt <= Math.floor(new Date().getTime() / 1000)
    );
    // in case there are no exercises due, make a popup and return
    if (oldDueExercises.length == 0) {
      alert("You have nothing left to do right now! Come back later!");
      gameMode.value = "undetermined";
      return;
    }
    const randomIndex = Math.floor(Math.random() * 20);
    // pick an old exercise
    const newExercise = oldDueExercises.sort((a, b) => a.sr.dueAt - b.sr.dueAt)[
      Math.min(randomIndex, oldDueExercises.length - 1)
    ];
    exercise.value = newExercise;
  } else if (gameMode.value == "new") {
    // find an exercise with the currently practiced sentence with a practiceBucket value of less than 3
    // also make sure its not the same twice in a row (except if there is only one exercise left)
    possibleExercises = possibleExercises.filter(
      (possibleExercise) =>
        possibleExercise.sentence_en == currentlyPracticedSentence.value &&
        possibleExercise.practiceBucket < 3
    );
    // this has to be in two steps because we need to refer to the length of the initially filtered array
    if (possibleExercises.length > 1) {
      possibleExercises = possibleExercises.filter(
        (possibleExercise) => possibleExercise != exercise.value
      );
    }

    // if there are no exercises left, reset gameMode
    if (possibleExercises.length == 0) {
      gameMode.value = "undetermined";
      return;
    }
    // pick a random exercise from the possible exercises
    const newExercise =
      possibleExercises[Math.floor(Math.random() * possibleExercises.length)];
    exercise.value = newExercise;
  }
}

// compute how many old due exercises there are rn
function oldDueExercisesCount() {
  let possibleExercises = exercises;
  if (!studyMSA.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "MSA"
    );
  }
  if (!studyEgyptian.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "Egyptian"
    );
  }
  return possibleExercises.filter(
    (exercise) =>
      exercise.stats.length > 0 &&
      exercise.sr.dueAt <= Math.floor(new Date().getTime() / 1000)
  ).length;
}

// function to change how many distinct main sentences (NOT exercises) have never been practiced
function newSentencesCount() {
  let NewMainSentenceArray = [];
  let possibleExercises = exercises;
  if (!studyMSA.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "MSA"
    );
  }
  if (!studyEgyptian.value) {
    possibleExercises = possibleExercises.filter(
      (exercise) => exercise.dialect != "Egyptian"
    );
  }
  for (const exercise of possibleExercises) {
    if (
      exercise.stats.length == 0 &&
      !NewMainSentenceArray.includes(exercise.sentence_en)
    ) {
      NewMainSentenceArray.push(exercise.sentence_en);
    }
  }
  return NewMainSentenceArray.length;
}

function userSawExerciseBefore() {
  return exercise.value.stats.length > 0;
}

async function handleAnswer(rating) {
  exercisesDoneThisSession.value++;
  lastAnswerWasCorrect.value = rating;

  if (gameMode.value == "practice") {
    practiceExercisesDoneThisSession.value++;
    // if we're in practice mode, we're doing the usual naive SR

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
  } else if (gameMode.value == "new") {
    // add one to practiceBucket if correct, otherwise set minus one
    exercise.value.practiceBucket += rating ? 1 : -1;
  }

  // set dueAt to now + interval
  exercise.value.sr.dueAt =
    Math.floor(new Date().getTime() / 1000) + exercise.value.sr.interval;
  const statsObj = {
    gameMode: gameMode.value,
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

function progress() {
  if (gameMode.value == "new") {
    console.log("new");
    // add the all the practiceBuckets of the currently practiced sentence
    const practiceBuckets = exercises
      .filter(
        (exercise) => exercise.sentence_en == currentlyPracticedSentence.value
      )
      .map((exercise) => exercise.practiceBucket);
    return {
      current:
        practiceBuckets.reduce((a, b) => a + b, 0) / practiceBuckets.length,
      total:
        exercises.filter(
          (exercise) => exercise.sentence_en == currentlyPracticedSentence.value
        ).length * 3,
    };
  } else if (gameMode.value == "practice") {
    console.log("practice");
    return {
      current: practiceExercisesDoneThisSession.value,
      total: oldDueExercisesCount() + practiceExercisesDoneThisSession.value,
    };
  }
  return {};
}
</script>

<template>
  <main class="p-2 flex flex-col items-center flex-grow justify-center">
    <div v-if="gameMode == 'undetermined'">
      <h2 class="text-4xl font-bold my-20">
        <span v-if="exercisesDoneThisSession > 0">
          Choose what to do next:
        </span>
        <span v-else>
          Welcome to Arabic Basic Sentences Practice. <br />
          Choose what to do first:
        </span>
      </h2>
      <div class="flex gap-2 flex-wrap justify-center">
        <button
          class="btn btn-success flex flex-grow flex-col"
          @click="setGameMode('practice')"
          :class="oldDueExercisesCount() > 0 ? 'btn-success' : 'btn-disabled'"
        >
          Practice Previous Exercises
          <small> ({{ oldDueExercisesCount() }} due) </small>
        </button>
        <button
          class="btn btn-primary flex-grow flex flex-col"
          @click="setGameMode('new')"
          :class="newSentencesCount() > 0 ? 'btn-primary' : 'btn-disabled'"
        >
          Learn New Sentence
          <small> ({{ newSentencesCount() }} left) </small>
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

          <small class="uppercase">
            {{ exercise.dialect }}
          </small>
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
    <div
      class="flex gap-2 justify-between w-full items-center"
      v-if="gameMode != 'undetermined'"
    >
      <div class="flex gap-2 flex-grow items-center">
        <small>Progress:</small>
        <progress
          class="flex-grow h-2"
          :value="progress().current"
          :max="progress().total"
        >
          {{ progress().current }} / {{ progress().total }}
        </progress>
      </div>
      <button
        class="btn btn-small"
        @click="gameMode = 'undetermined'"
        v-if="gameMode != 'undetermined'"
      >
        Exit Lesson
      </button>
    </div>
  </main>

  <footer class="border-t-2 mt-10 w-full p-4 text-sm">
    <!-- red background when nothing is selected -->
    <div class="mb-4" :class="studyMSA || studyEgyptian ? '' : 'bg-red-700 text-white'">
      <fieldset class="flex gap-2  px-2">
        <input
          type="checkbox"
          id="check-msa"
          v-model="studyMSA"
          class="form-checkbox"
        />
        <label for="check-msa">Include MSA Sentences</label>
      </fieldset>
      <fieldset class="flex gap-2  px-2">
        <input
          type="checkbox"
          id="check-msa"
          v-model="studyEgyptian"
          class="form-checkbox"
        />
        <label for="check-msa">Include Egyptian Sentences</label>
      </fieldset>
    </div>
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
