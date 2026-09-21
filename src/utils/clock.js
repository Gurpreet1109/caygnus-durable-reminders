function createClock(nowProvider = () => new Date()) {
  return {
    now() {
      return nowProvider();
    },
  };
}

const systemClock = createClock();

module.exports = {
  createClock,
  systemClock,
};
