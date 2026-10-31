<style scoped>
.button-with-icon {
  width: 120px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #0B95FA;
  font-family: "Istok Web", sans-serif;
  letter-spacing: 1px;
  padding: 0 12px;
  text-align: center;
  font-size: 14px;
  text-transform: uppercase;
  font-weight: normal;
  border-radius: 3px;
  outline: none;
  user-select: none;
  cursor: pointer;
  transform: translateY(0px);
  position: relative;
  box-shadow: inset 0 30px 30px -15px rgba(255, 255, 255, 0.1),
  inset 0 0 0 1px rgba(255, 255, 255, 0.3),
  inset 0 1px 20px rgba(0, 0, 0, 0),
  0 3px 0 #0B95FA,
  0 3px 2px rgba(0, 0, 0, 0.2),
  0 5px 10px rgba(0, 0, 0, 0.1),
  0 10px 20px rgba(0, 0, 0, 0.1);
  background: #0B95FA;
  color: white;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  transition: 150ms all ease-in-out;
}

.button-with-icon .icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  transition: all 0.5s ease-in-out;
}

.button-with-icon:active {
  transform: translateY(3px);
  box-shadow: inset 0 16px 2px -15px rgba(0, 0, 0, 0),
  inset 0 0 0 1px rgba(255, 255, 255, 0.15),
  inset 0 1px 20px rgba(0, 0, 0, 0.1),
  0 0 0 #0B95FA,
  0 0 0 2px rgba(255, 255, 255, 0.5),
  0 0 0 rgba(0, 0, 0, 0),
  0 0 0 rgba(0, 0, 0, 0);
}

.button-with-icon:hover .text {
  transform: translateX(80px);
}

.button-with-icon:hover .icon {
  transform: translate(23px);
}

.text {
  transition: all 0.5s ease-in-out;
}
</style>

<template>
  <button class="button-with-icon">
    <svg
        class="icon"
        id="Play"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
    >
      <path
          class="color000000 svgShape"
          fill="#ffffff"
          d="M12 39c-.549 0-1.095-.15-1.578-.447A3.008 3.008 0 0 1 9 36V12c0-1.041.54-2.007 1.422-2.553a3.014 3.014 0 0 1 2.919-.132l24 12a3.003 3.003 0 0 1 0 5.37l-24 12c-.42.21-.885.315-1.341.315z"
      ></path>
    </svg>
    <span class="text">Play</span>
  </button>
</template>