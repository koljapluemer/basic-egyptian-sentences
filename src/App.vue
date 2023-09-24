<script setup>
import numbers from "./numbers.js";
import { ref, watch } from "vue";
import { supabase } from "./lib/supabaseClient";

let numberBank = numbers;
let fieldUsedAsPrompt = ref("");
let fieldUsedAsAnswer = ref("");
let possibleAnswers = ref([]);
let prompt = ref("");
let correctAnswer = ref("");
let givenAnswer = ref("");
let indexOfAnswerClicked = ref(null);
const exercise = ref(null);
let exercisesDoneThisSession = 0;
let exercises = [];
let streak = ref(0);
// loop the number bank, add all possible exercises to the exercises array
// all possible exercises: all pairs of prompts and answer types (val, ar, ar_long, transliteration)
// also add a stats and sr property to each exercise, and take the level property from the parent element from numberBank:
const possibleExerciseCombinations = [
  ["val", "ar"],
  ["val", "ar_long"],
  ["val", "transliteration"],
  ["ar", "val"],
  ["ar", "ar_long"],
  ["ar", "transliteration"],
  ["ar", "en"],
  ["ar_long", "val"],
  ["ar_long", "ar"],
  ["ar_long", "transliteration"],
  ["ar_long", "en"],
  ["en", "ar"],
  ["en", "ar_long"],
  ["en", "transliteration"],
  ["transliteration", "val"],
  ["transliteration", "ar"],
  ["transliteration", "ar_long"],
  ["transliteration", "en"],
];

const missions = ref({
  "Exercises Done": {
    goals: [0, 10, 50, 100, 200, 500, 1000, 10000],
    progress: 0,
    currentGoal: 1,
  },
  Streak: {
    goals: [0, 3, 5, 10, 20, 50, 100, 200],
    progress: 0,
    currentGoal: 1,
  },
});
// if missions on localStorage, load it
if (localStorage.getItem("missions")) {
  missions.value = JSON.parse(localStorage.getItem("missions"));
}

// if uid is not in localStorage, create one and save
let uid;
if (localStorage.getItem("uid")) {
  uid = localStorage.getItem("uid");
} else {
  uid = Math.random().toString(36).substring(2, 15);
  localStorage.setItem("uid", uid);
}

// deep watch missions and save to localStorage:
watch(
  missions,
  (newValue) => {
    localStorage.setItem("missions", JSON.stringify(newValue));
  },
  { deep: true }
);

const easyExerciseTypes = ["val", "ar", "transliteration"];

for (const number of numberBank) {
  for (const exerciseCombination of possibleExerciseCombinations) {
    const ex = {
      promptType: exerciseCombination[0],
      answerType: exerciseCombination[1],
      prompt: number[exerciseCombination[0]],
      correctAnswer: number[exerciseCombination[1]],
      stats: [],
      sr: {
        repetitions: 0,
        interval: 10,
        dueAt: Math.floor(new Date().getTime() / 1000),
      },
      number: number,
    };
    exercises.push(ex);
  }
}

// see if numberBank is in localStorage, if so, load it,  if not, set it to the imported numbers (feel free to disable conditional for developing)
if (localStorage.getItem("numberBank")) {
  // if it is in localStorage, set the numberBank to the localStorage value
  numberBank = JSON.parse(localStorage.getItem("numberBank"));
}
// same for exercises
if (localStorage.getItem("exercises")) {
  // if it is in localStorage, set the numberBank to the localStorage value
  exercises = JSON.parse(localStorage.getItem("exercises"));
}

function getNextExercise() {
  guessMade.value = false;
  let possibleExercises = exercises;
  // for the first 10 exercises, only use easy exercises
  if (exercisesDoneThisSession < 10) {
    possibleExercises = exercises.filter(
      (exercise) =>
        easyExerciseTypes.includes(exercise.promptType) &&
        easyExerciseTypes.includes(exercise.answerType)
    );
  }

  // new exercises are those whose stats array is empty
  const newDueExercises = possibleExercises.filter(
    (exercise) => exercise.stats.length == 0
  );
  // also check if parent number is due (or due is null)
  const oldDueExercises = possibleExercises.filter(
    (exercise) =>
      exercise.stats.length > 0 &&
      exercise.sr.dueAt <= Math.floor(new Date().getTime() / 1000) &&
      (numberBank[exercise.number.val].sr.dueAt <=
        Math.floor(new Date().getTime() / 1000) ||
        numberBank[exercise.number.val].sr.dueAt == null)
  );
  // in case there are no exercises due, make a popup and return
  if (newDueExercises.length == 0 && oldDueExercises.length == 0) {
    alert("You have nothing left to do right now! Come back later!");
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

  fieldUsedAsPrompt.value = exercise.value.promptType;
  fieldUsedAsAnswer.value = exercise.value.answerType;
  prompt.value = exercise.value.prompt;
  correctAnswer.value = exercise.value.correctAnswer;
  // have a 4 possible answer fields: one is the correct one, the rest is wrong ones picked from the data
  possibleAnswers.value = [exercise.value.correctAnswer];
  // try to find a possible answer out of the pool of already practiced numbers (but the type must match):
  const alreadyPracticedExercises = exercises.filter(
    (exercise) => exercise.stats.length > 0
  );
  for (let i = 0; i < alreadyPracticedExercises.length; i++) {
    const alreadyPracticedExercise = alreadyPracticedExercises[i];
    if (
      alreadyPracticedExercise.answerType == exercise.value.answerType &&
      !possibleAnswers.value.includes(alreadyPracticedExercise.correctAnswer)
    ) {
      possibleAnswers.value.push(alreadyPracticedExercise.correctAnswer);
      break;
    }
  }
  // add a mean possible answer:
  // randomly pick the number that is either 3, 2, 1 smaller or bigger than the correct answer
  // catch edge cases (only numbers from 0 to 100 exists)
  // also don't add the answer if it is already in the possible answers
  const possibleMeanAnswerNumber =
    exercise.value.number.val + Math.floor(Math.random() * 7) - 3;
  if (possibleMeanAnswerNumber >= 0 && possibleMeanAnswerNumber <= 100) {
    const possibleMeanAnswer =
      numberBank[possibleMeanAnswerNumber][exercise.value.answerType];
    if (!possibleAnswers.value.includes(possibleMeanAnswer)) {
      possibleAnswers.value.push(possibleMeanAnswer);
    }
  }
  const lengthOfPossibleAnswers = possibleAnswers.value.length;
  // now, get random wrong answers with the same type as the correct answer (until we have 4 answers)
  for (let i = 0; i < 4 - lengthOfPossibleAnswers; i++) {
    let newWrongAnswer =
      numberBank[Math.floor(Math.random() * numberBank.length)][
        exercise.value.answerType
      ];
    while (
      possibleAnswers.value.includes(newWrongAnswer) ||
      newWrongAnswer == correctAnswer.value
    ) {
      newWrongAnswer =
        numberBank[Math.floor(Math.random() * numberBank.length)][
          exercise.value.answerType
        ];
    }
    possibleAnswers.value.push(newWrongAnswer);
  }
  // shuffle the possible answers
  possibleAnswers.value = possibleAnswers.value.sort(() => Math.random() - 0.5);
}

let guessMade = ref(false);

getNextExercise();

function userSawExerciseBefore() {
  return exercise.value.stats.length > 0;
}

async function handleAnswer(answer) {
  // MISSIONS
  missions.value["Exercises Done"].progress++;
  if (
    missions.value["Exercises Done"].progress >=
    missions.value["Exercises Done"].goals[
      missions.value["Exercises Done"].currentGoal
    ]
  ) {
    missions.value["Exercises Done"].currentGoal++;
  }
  // ---- //

  exercisesDoneThisSession++;
  const guessWasCorrect = answer === correctAnswer.value;
  guessMade.value = true;
  givenAnswer.value = answer;
  indexOfAnswerClicked.value = possibleAnswers.value.indexOf(answer);

  // if answer correct, double interval, if incorrect, half interval (minimum 10)
  if (guessWasCorrect) {
    streak.value++;
    // MISSIONS
    missions.value["Streak"].progress++;
    if (
      missions.value["Streak"].progress >=
      missions.value["Streak"].goals[missions.value["Streak"].currentGoal]
    ) {
      missions.value["Streak"].currentGoal++;
    }
    // ---- //
    exercise.value.sr.repetitions++;
    //  max level is 10
    numberBank[exercise.value.number.val].level = Math.min(
      numberBank[exercise.value.number.val].level + 1,
      10
    );
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
    // also double the sr.interval of the parent number
    numberBank[exercise.value.number.val].sr.interval =
      numberBank[exercise.value.number.val].sr.interval * 2;
  } else {
    streak.value = 0;
    // MISSIONS
    missions.value["Streak"].progress = 0;
    // ---- //
    exercise.value.sr.repetitions = 0;
    // divide level by 2 and round down
    numberBank[exercise.value.number.val].level = Math.floor(
      numberBank[exercise.value.number.val].level / 2
    );
    exercise.value.sr.interval = Math.max(exercise.value.sr.interval / 2, 10);
    // also reset parent number interval
    numberBank[exercise.value.number.val].sr.interval =
      numberBank[exercise.value.number.val].sr.interval / 2;
  }

  // set dueAt to now + interval
  exercise.value.sr.dueAt =
    Math.floor(new Date().getTime() / 1000) + exercise.value.sr.interval;
  const statsObj = {
    guessWasCorrect: guessWasCorrect,
    guess: answer,
    correctAnswer: correctAnswer.value,
    prompt: prompt,
    promptType: fieldUsedAsPrompt.value,
    answerType: fieldUsedAsAnswer.value,
    timestamp: Math.floor(new Date().getTime() / 1000),
  };
  exercise.value.stats.push(statsObj);
  // set dueAt of parent exercise
  numberBank[exercise.value.number.val].sr.dueAt =
    Math.floor(new Date().getTime() / 1000) +
    numberBank[exercise.value.number.val].sr.interval;
  // save the numberBank and exercises to localStorage
  localStorage.setItem("numberBank", JSON.stringify(numberBank));
  localStorage.setItem("exercises", JSON.stringify(exercises));
  try {
    const { data, error } = await supabase.from("learning_data").insert([
      {
        user_uid: uid,
        learning_result: JSON.stringify(statsObj),
      },
    ]);
  } catch (error) {
    console.error(error);
  }
}

function calculateColor(level) {
  // make the bar go from 0=yellow to 10=green to 100=light-blue smoothly (so for example five will be a greenish yellow)
  if (level < 0) level = 0;
  if (level > 100) level = 100;

  // Define the HSL values for the specified levels
  const levels = {
    0: { h: 37, s: 89, l: 53 },
    10: { h: 106, s: 89, l: 53 },
    100: { h: 205, s: 89, l: 53 },
  };

  // If the level is one of the specified levels, return the corresponding color
  if (level in levels) {
    const { h, s, l } = levels[level];
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // For intermediate levels, interpolate between the specified levels
  const lowerLevel = Math.floor(level / 10) * 10;
  const upperLevel = Math.ceil(level / 10) * 10;

  const lowerColor = levels[lowerLevel];
  const upperColor = levels[upperLevel];

  const fraction = (level - lowerLevel) / (upperLevel - lowerLevel);

  const h = lowerColor.h + (upperColor.h - lowerColor.h) * fraction;
  const s = lowerColor.s + (upperColor.s - lowerColor.s) * fraction;
  const l = lowerColor.l + (upperColor.l - lowerColor.l) * fraction;

  return `hsl(${h}, ${s}%, ${l}%)`;
}

function convertNumberToArabicScript(number) {
  const arabicNumbers = {
    0: "٠",
    1: "١",
    2: "٢",
    3: "٣",
    4: "٤",
    5: "٥",
    6: "٦",
    7: "٧",
    8: "٨",
    9: "٩",
  };
  const numberAsString = number.toString();
  let arabicNumber = "";
  for (let i = 0; i < numberAsString.length; i++) {
    arabicNumber += arabicNumbers[numberAsString[i]];
  }
  return arabicNumber;
}
</script>

<template>
  <main class="p-2 flex flex-col items-center">
    <div
      class="card bg-gray-600 shadow-xl m-4 p-4 flex flex-col justify-start items-center w-3/4 max-w-screen-xl"
      v-if="exercise"
      style="min-height: 390px"
    >
      <p class="border-b p-2" v-if="exercisesDoneThisSession < 3">
        Select the matching answers out of the four options below. If you are
        not sure, just guess!
      </p>
      <div id="prompt" class="text-3xl p-2">
        {{ prompt }}
      </div>
      <div class="card-actions flex-col justify-end mt-6 pt-2">
        <button
          style="line-height: 1em"
          class="btn text-2xl w-full max-w-1/3 lowercase p-2"
          :class="{
            'btn-success':
              guessMade &&
              index == indexOfAnswerClicked &&
              givenAnswer === correctAnswer,
            'btn-error':
              guessMade &&
              index == indexOfAnswerClicked &&
              givenAnswer !== correctAnswer,
            'btn-info':
              guessMade &&
              index != indexOfAnswerClicked &&
              answer === correctAnswer &&
              givenAnswer !== correctAnswer,
            'text-3xl': fieldUsedAsAnswer == 2,
            'shine-button wiggle-button':
              answer === correctAnswer &&
              streak < 3 &&
              !guessMade &&
              !userSawExerciseBefore(prompt),
          }"
          v-for="(answer, index) in possibleAnswers"
          @click="handleAnswer(answer)"
        >
          {{ answer }}
        </button>

        <button
          class="btn btn-primary mt-4 self-end"
          @click="getNextExercise"
          v-if="guessMade"
        >
          Next
        </button>
      </div>
    </div>

    <h2 class="text-xl font-bold m-2">Missions</h2>
    <div class="m-2 flex flex-col max-w-md" v-for="(mission, name) in missions">
      {{ name }}
      <!-- progress bar: -->
      <progress
        class="w-full"
        :value="mission.progress"
        :max="mission.goals[mission.currentGoal]"
      ></progress>

      {{ convertNumberToArabicScript(mission.progress) }} /
      {{ convertNumberToArabicScript(mission.goals[mission.currentGoal]) }}
    </div>

    <h2 class="text-xl font-bold m-2">Statistics</h2>

    <div class="grid gap-2" style="grid-template-columns: repeat(10, 1rem)">
      <div
        v-for="(number, index) in numberBank.sort((a, b) => a.val - b.val)"
        :key="index"
        class="w-4 h-4 flex items-center justify-center bg-gray-900 relative rounded"
      >
        <!-- Battery bar -->
        <!-- make the bar go from 0=yellow to 10=green to 100=light-blue smoothly (so for example five will be a greenish yellow) -->
        <div
          class="absolute inset-0 bg-yellow-500 bottom-0"
          :style="{
            height: number.level * 10 + '%',
            backgroundColor: calculateColor(number.level),
          }"
          style="transition: height 0.5s ease"
        ></div>
      </div>
    </div>
  </main>
  <footer class="border-t-2 mt-10 w-full p-4 text-sm">
    <ul class="flex flex-col gap-2">
      <li>
        Transliterations are Egyptian Arabic. For now. I'm working on an option
        to choose between different dialects.
      </li>
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
