
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

function getPossibleEmails(phone) {
  const digits = phone.replace(/\D/g, "");
  const numbers = new Set([digits]);

  // Bangladesh: +88017... -> 017...
  if (digits.startsWith("880")) {
    const local = "0" + digits.slice(3);
    numbers.add(local);
    numbers.add(local.slice(1));
  } else if (digits.startsWith("0")) {
    numbers.add("880" + digits.slice(1));
    numbers.add(digits.slice(1));
  } else if (digits.startsWith("1") && digits.length === 10) {
    numbers.add("0" + digits);
    numbers.add("880" + digits);
  }

  return [...numbers].map(
    number => `${number}@lalandexpress.com`
  );
}

exports.resetCustomerPasswordByPhone = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "প্রথমে ফোন OTP যাচাই করুন।"
      );
    }

    const provider =
      request.auth.token.firebase?.sign_in_provider;

    if (provider !== "phone") {
      throw new HttpsError(
        "permission-denied",
        "ফোন OTP যাচাই করা আবশ্যক।"
      );
    }

    const phone = request.auth.token.phone_number;
    const newPassword = request.data?.newPassword;

    if (!phone) {
      throw new HttpsError(
        "permission-denied",
        "যাচাইকৃত ফোন নম্বর পাওয়া যায়নি।"
      );
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 6 ||
      newPassword.length > 128
    ) {
      throw new HttpsError(
        "invalid-argument",
        "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।"
      );
    }

    const auth = getAuth();

    // OTP-তে যাচাইকৃত নম্বরের সম্ভাব্য পুরোনো
    // ইমেইল-পাসওয়ার্ড অ্যাকাউন্ট খুঁজুন।
    for (const email of getPossibleEmails(phone)) {
      let account;

      try {
        account = await auth.getUserByEmail(email);
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          continue;
        }
        throw error;
      }

      // শুধু Email/Password অ্যাকাউন্ট পরিবর্তন করুন।
      const hasPasswordProvider =
        account.providerData.some(
          item => item.providerId === "password"
        );

      if (!hasPasswordProvider) {
        continue;
      }

      await auth.updateUser(account.uid, {
        password: newPassword
      });

      return {
        success: true,
        message: "পাসওয়ার্ড পরিবর্তন হয়েছে।"
      };
    }

    throw new HttpsError(
      "not-found",
      "এই ফোন নম্বরের সঙ্গে মিলে এমন পুরোনো পাসওয়ার্ড অ্যাকাউন্ট পাওয়া যায়নি।"
    );
  }
);
