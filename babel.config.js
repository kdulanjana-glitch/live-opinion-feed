module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Disable React Compiler — it hangs Metro on complex ref patterns.
          'react-compiler': false,
        },
      ],
    ],
    // DO NOT add react-native-reanimated/plugin or react-native-worklets/plugin here.
    // babel-preset-expo v56+ auto-detects both packages and adds the worklets plugin once.
    // Adding it again causes the same transform to run twice, hanging Metro at 99%.
  };
};
