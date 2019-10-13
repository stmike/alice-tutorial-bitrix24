const fetch = require('node-fetch');
const { lowerCase, random, sample, truncate, upperFirst } = require('lodash');

// Вебхук Битрикс24: ЗАМЕНИТЕ НА СОБСТВЕННЫЙ АКТУАЛЬНЫЙ, И ДЕРЖИТЕ В ТАЙНЕ!
// Вместо xxx... в первом случае -- актуальный ID вашего аккаунта Битрикс24.
// Вместо xxx... во втором случае -- актуальный код для входящего вебхука.
// Входящий вебхук получаем в консоли Битрикс24:
// (Ещё) --> Приложения --> Вебхуки (вкладка) --> Добавить вебхук (кнопка) --> Входящий вебхук (выпадающий список). 
// Затем поставить чекбокс напротив CRM (crm).
// Последнюю часть URL сгенерированного вебхука /profile/ удалить, и заменить на: /crm.lead.add.json
const bitrix24Webhook = 'https://xxxxxx.bitrix24.ru/rest/1/xxxxxxxxxxxx/crm.lead.add.json';

// Идентификаторы загруженных в консоли разработчика Алисы изображений (xxx... заменить на актуальные).
// Рекомендумый размер изображений: 512x230 px; требуемый формат: JPEG, JPG, PNG.
// Рекомендуется предварительно сжать изображения с помощью какой-нибудь утилиты, например:
// https://imagecompressor.com/
const imgDefault = 'xxxxxxxxxxxxxxxx';
const imgSuccess = 'xxxxxxxxxxxxxxxx';
const imgFailure = 'xxxxxxxxxxxxxxxx';

// URL для кнопки сбора донатов (пожертвований на разработку); можете заменить на свой:
const donateUrl = 'https://yasobe.ru/na/vui';


// Тело нашей Cloude Function (мы назвали модуль skill, но можно назвать его и по другому -- главное указать это назавание в консоли Яндекс.Облака):
module.exports.skill = async (event) => {

  // Получаем из запроса Алисы нужные нам для работы объекты:
  const { meta, request, session, version } = event;

  // Будущее сообщение юзеру (знак пробела -- страховка от ошибки, если при каких-то обстоятельствах значение не присвоится):
  let msg = ' ';

  // Закрыта ли сессия:
  let isEndSession = false;

  // Получаем (и переводим в нижний регистр) сказанную юзером фразу:
  const userUtterance = lowerCase(request.original_utterance);


  // Быстрый ответ (чтобы не крутить весь код) на пингование от Яндекса:
  if (userUtterance === 'ping') {
    msg = 'OK';
    isEndSession = true;
    return {
      version,
      session,
      response: {
        text: msg,
        end_session: isEndSession
      }
    };
  }


  // Проверяем есть ли у девайса юзера экран (т.е. смартфон это или колонка):
  const hasScreen = typeof meta.interfaces.screen !== 'undefined' ? true : false;

  // Получаем начальную команду юзера (если есть; в противном случае будет пустая строка):
  const userCommand = lowerCase(request.command);


  // Получаем массив всех слов из фразы юзера:
  let userWords = [];

  if (request.nlu.tokens.length > 0) {
    const tokensArr = request.nlu.tokens;
    for (let i = 0; i < tokensArr.length; i++) {
      userWords.push(tokensArr[i]);
    }
  }


  // Получаем необходимые нам сущности API Яндекс.Диалоги:
  let firstName, lastName;

  if (request.nlu.entities.length !== 0) {
    for (let i = 0; i < request.nlu.entities.length; i++) {
      let value = request.nlu.entities[i].value;
      firstName = value && value.first_name;
      lastName = value && value.last_name;
    }
  }


  // Для звуков на события удачная/неудачная отправка заказа:
  let ttsMsg = '';

  // Слот для кнопок (в данном случае у нас будет одна кнопка -- для сбора донаций):
  let buttonSlot = [];

  // На примере рендомной смены надписи на кнопке, демонстрируем как легко можно разнообразить 
  // тексты и фразы Алисы с помощью функции sample() из библиотеки Lodash:
  const buttonTitle = ['Кинь монетку', 'Брось пятак', 'Поддержи разработку'];

  // Кнопка для донаций (пожертвований на разработку):
  const donateButton = { title: sample(buttonTitle), hide: true, url: donateUrl };


  // Карточка с картинками:
  let card = {};
  let imgId = imgDefault;
  let imgTitle = 'Оформление заказа';
  let imgDesc = 'Назовите ваше имя и фамилию.';



  // Диалог с юзером до оформления заказа:
  if (!userCommand || !userUtterance) {
    msg = 'Привет! Я супер-продавец, использующий Битрикс 24. Чтобы оформить заказ, мне необходимы некоторые сведения. Назовите, пожалуйста, ваше имя и фамилию.';
  } else {
    if (userUtterance === 'нет' || userUtterance === 'не хочу' || userUtterance === 'не назову' ||
      userUtterance === 'не буду' || userUtterance === 'закрыть' || userUtterance === 'выйти' ||
      userUtterance === 'выход' || userUtterance === 'завершить') {
      msg = 'До свидания! Когда захотите что-нибудь купить - обращайтесь ко мне.';
      imgTitle = 'До свидания!';
      imgDesc = 'Заказ не оформлен.';
      buttonSlot = [];
      isEndSession = true;
    } else if (userUtterance === 'что ты умеешь') {
      msg = 'Я умею отправлять заказы в Битрикс 24. Для этого мне необходимо знать ваше имя и фамилию. Пожалуйста, назовите их.';
    } else if (userUtterance === 'помощь' || userUtterance === 'справка') {
      msg = 'Я демонстрирую отправку заказов в Битрикс 24. Для этого назовите мне ваше имя и фамилию.';
    } else if (!firstName && !lastName) {
      msg = 'Для оформления заказа мне необходимо знать ваше имя и фамилию. Пожалуйста, назовите мне их.';
    } else if (firstName && !lastName) {
      msg = 'Для оформления заказа мне необходимо знать не только ваше имя, но и фамилию. Пожалуйста, назовите сразу и то и другое.';
    } else if (!firstName && lastName) {
      msg = 'Для оформления заказа мне необходимо знать не только вашу фамилию, но и имя. Пожалуйста, назовите вместе и то и другое.';
    }
  }


  // Юзер ответил на все наши вопросы (в данном примере -- назвал своё имя и фамилию):
  if (firstName && lastName) {
    // Формируем заказ. Кроме имени и фамилии (а также рендомного номера заказа) -- всё остальное статично.
    // Эти дополнительные свойства вставлены в заказ, чтобы показать основные полезные поля лидов Битрикс24. 
    // Таблицы со всеми доступными свойствами см. по этим ссылкам:
    // https://dev.1c-bitrix.ru/rest_help/crm/fields.php#lids
    // https://dev.1c-bitrix.ru/community/blogs/chaos/crm-sozdanie-lidov-iz-drugikh-servisov.php
    const order = {
      fields: {
        TITLE: 'Заказ через Алису #' + random(1, 100),
        NAME: upperFirst(firstName),
        LAST_NAME: upperFirst(lastName),
        PHONE: [{ VALUE: '+79101112233', VALUE_TYPE: 'MOBILE' }],
        ADDRESS: 'Новый Арбат, 5',
        ADDRESS_2: 'офис 123',
        ADDRESS_CITY: 'Москва',
        COMMENTS: 'Товар. Кол-во: 2',
        OPPORTUNITY: 1200.00,
        CURRENCY_ID: 'RUB',
        STATUS_ID: 'NEW',
        SOURCE_ID: 'PARTNER',
        PRODUCT_ID: 'OTHER'
      },
      params: { 'REGISTER_SONET_EVENT': 'Y' }
    };

    // Отправляем заказ в Битрикс24:
    fetch(bitrix24Webhook, {
      method: 'post',
      body: JSON.stringify(order),
      headers: { 'Content-Type': 'application/json' }
    }).then(res => res.json())
      .then(
        // Сообщение об успешном оформлении заказа со звуковым эффектом. Библиотека звуков здесь: 
        // https://yandex.ru/dev/dialogs/alice/doc/sounds-docpage/
        ttsMsg = '<speaker audio="alice-sounds-game-ping-1.opus"> Заказ успешно оформлен и отправелен в Битрикс 24! Я закрываю эту сделку. Когда захотите что-нибудь купить - обращайтесь только ко мне. До встречи!',
        imgTitle = 'Спасибо за заказ!',
        imgDesc = 'Заказ успешно оформлен.',
        imgId = imgSuccess,
        buttonSlot = [],
        isEndSession = true
      )
      .catch(err => {
        // И сообщение об ошибке отправки -- тоже со звуковым эффектом (другим):
        ttsMsg = '<speaker audio="alice-sounds-game-loss-2.opus"> Возникла какая-то ошибка, поэтому оформить заказ не удалось. Попробуйте повторить немного позже. А я пока закрою эту сессию. До скорой встречи!';
        imgTitle = 'Ошибка!';
        imgDesc = 'Не удалось ооформить заказ.';
        imgId = imgFailure;
        buttonSlot = [];
        isEndSession = true;
        console.error('Fail sending lead to Bitrix24: ' + err);
      });
  }


  // Если у юзера есть экран -- будем слать ему картинки и кнопку:
  if (hasScreen && donateUrl) {
    // Формируем карточку с картинкой:
    card = {
      type: 'BigImage',
      image_id: imgId,
      // На всякий случай, для сохранения "товарного вида", 
      // ограничим длину строк с троеточием в конце:
      title: truncate(imgTitle.toUpperCase(), { length: 35 }),
      description: truncate(imgDesc, { length: 256 }),
      // Кнопка -- клик по карточке:
      button: {
        url: donateUrl,
      }
    };

    // Если сессия не закрыта -- кнопку в слот:
    if (!isEndSession)
      buttonSlot.push(donateButton);
  }


  // Наш ответ Алисе:
  return {
    version,
    session,
    response: {
      text: msg,
      tts: ttsMsg,
      card: card,
      buttons: buttonSlot,
      end_session: isEndSession
    }
  };
};