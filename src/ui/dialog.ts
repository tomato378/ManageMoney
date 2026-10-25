// react-native-web の Alert.alert は何も表示しないので、ブラウザ標準のダイアログを使う

export function notify(title: string, message?: string) {
  window.alert(message ? `${title}\n\n${message}` : title);
}

export function confirmAsync(title: string, message?: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
}
