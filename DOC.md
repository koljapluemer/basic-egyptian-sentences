Simple Vue project, copied from the pronounciation tutor.

## App.vue

so far, that's where literally everything happens. Classic learning setup: one function `getRandomNumber()` to get the next exercise, one `handleAnswer()` to handle the SR logic etc.

We're doing some fancy stuff to get weighted card selection, but apart from that, it's just semi-well organized standard SR stuff. Using localStorage to save user progress.

## LocalStorage / Data

Currently no data is saved in the browser, because that breaks when I change the data structure.
Both the `numberBank` fed from `numbers.js` and the generated `exercises` are currently dynamic (numbers track progress for the grid) and would have to be saved to localstorage.