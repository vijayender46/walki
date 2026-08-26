export const shadows = {
  parentCard: {
    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.09,
    shadowRadius: 22,

    elevation: 5,
  },

  parentSoft: {
    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.07,
    shadowRadius: 14,

    elevation: 3,
  },

  parentButton: {
    shadowColor: "#FF8200",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,

    elevation: 9,
  },

  avatar: {
    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,

    elevation: 4,
  },

  navigation: {
    shadowColor: "#B66C24",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 20,

    elevation: 8,
  },
} as const;
