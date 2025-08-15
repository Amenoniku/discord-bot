# 1. Используем официальный образ Node.js как базу
FROM node:22-alpine3.19

# Меняем зеркало перед установкой
RUN apk add --no-cache \
  ffmpeg \
  python3 \
  make \
  g++
# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# 3. Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# 4. Устанавливаем зависимости
RUN npm install -g node-gyp

RUN npm install
RUN mkdir -p resources
# 5. Копируем остальные файлы проекта
COPY . .

# 6. Собираем TypeScript в JS
RUN npm run build

# 7. Указываем команду для запуска приложения
CMD ["npm", "run", "start-prod"]
