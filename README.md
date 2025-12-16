# Primeiro Passo

Instale as dependências com:

```bash
npm install
```

# Segundo Passo

## Celular fora da mesma rede

Se o celular não estiver na mesma rede local, é possível utilizar o tunel Expo.

```bash
npx expo start --tunnel
```

Depois, abra o QR code no app Expo Go do seu dispositivo ou cole o link gerado

Observações:
- O túnel é prático, mas pode ser mais lento ou menos estável do que uma conexão LAN.
- Pode dar incompatibilidade dependendo do pacote por não ser nativo

## Celular dentro da mesma rede

Se o celular estiver na mesma rede, basta utilizar:

```bash
npx expo start
```

ou, para limpar cache

```bash
npx expo start -c
```