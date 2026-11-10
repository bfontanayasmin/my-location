import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  List,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Switch,
  Text,
} from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as SQLite from "expo-sqlite";

import myColors from "./assets/colors.json";
import myColorsDark from "./assets/colorsDark.json";

export default function App() {
  const [darkMode, setDarkMode] = useState(false); // variável para controle do darkMode
  const [temaCarregado, setTemaCarregado] = useState(false);
  const [banco, setBanco] = useState(null);
  const [localizacoes, setLocalizacoes] = useState([]); // variável para armazenar as localizações
  const [capturando, setCapturando] = useState(false); // variável para controle do loading do button

  // Carrega tema default da lib RN PAPER com customização das cores. Para customizar o tema, veja:
  // https://callstack.github.io/react-native-paper/docs/guides/theming/#creating-dynamic-theme-colors
  let tema = { ...MD3LightTheme, colors: myColors.colors };

  if (darkMode) {
    tema = { ...MD3DarkTheme, colors: myColorsDark.colors };
  }

  // load darkMode from AsyncStorage
  async function carregarTema() {
    try {
      const temaSalvo = await AsyncStorage.getItem("darkMode");
      setDarkMode(temaSalvo === "true");
    } catch {
      Alert.alert("Erro", "Não foi possível carregar o tema salvo.");
    } finally {
      setTemaCarregado(true);
    }
  }

  // darkMode switch event
  async function trocarTema(valor) {
    setDarkMode(valor);

    try {
      await AsyncStorage.setItem("darkMode", String(valor));
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o tema.");
    }
  }

  // load locations from db sqlite - faz a leitura das localizações salvas no banco de dados
  async function carregarLocalizacoes(db) {
    const lista = await db.getAllAsync(
      "SELECT * FROM localizacoes ORDER BY id DESC"
    );

    setLocalizacoes(lista);
  }

  async function abrirBanco() {
    try {
      const db = await SQLite.openDatabaseAsync("my-location.db");

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS localizacoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL
        );
      `);

      await carregarLocalizacoes(db);
      setBanco(db);
    } catch (erro) {
      console.log("Erro ao abrir o SQLite:", erro);
      Alert.alert("Erro", "Não foi possível abrir o banco de localizações.");
    }
  }

  // Use Effect para carregar o darkMode e as localizações salvas no banco de dados
  // É executado apenas uma vez, quando o componente é montado
  useEffect(() => {
    carregarTema();
    abrirBanco();
  }, []);

  // get location (bottao capturar localização)
  async function capturarLocalizacao() {
    if (!banco || capturando) {
      return;
    }

    setCapturando(true);
    let etapa = "pedir permissão";

    try {
      const permissao = await Location.requestForegroundPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à localização para usar a captura."
        );
        return;
      }

      etapa = "obter a localização";
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = posicao.coords;

      etapa = "salvar no SQLite";
      await banco.runAsync(
        "INSERT INTO localizacoes (latitude, longitude) VALUES (?, ?)",
        [latitude, longitude]
      );

      etapa = "atualizar a lista";
      await carregarLocalizacoes(banco);
    } catch (erro) {
      const mensagem = erro?.message || String(erro);

      console.log(`Erro ao ${etapa}:`, mensagem);
      Alert.alert(`Erro ao ${etapa}`, mensagem);
    } finally {
      setCapturando(false);
    }
  }

  return (
    <PaperProvider theme={tema}>
      <Appbar.Header>
        <Appbar.Content title="My Location" />
      </Appbar.Header>

      <View
        style={[styles.container, { backgroundColor: tema.colors.background }]}
      >
        <View style={styles.linhaTema}>
          <Text>Modo escuro</Text>
          <Switch
            value={darkMode}
            onValueChange={trocarTema}
            disabled={!temaCarregado}
          />
        </View>

        <Button
          mode="contained"
          icon="map"
          loading={capturando}
          disabled={!banco || capturando}
          onPress={capturarLocalizacao}
        >
          Capturar localização
        </Button>

        <FlatList
          style={styles.lista}
          data={localizacoes}
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={
            banco ? <Text>Nenhuma localização salva.</Text> : null
          }
          renderItem={({ item }) => (
            <List.Item
              title={`Localização ${item.id}`}
              description={`Latitude: ${item.latitude}\nLongitude: ${item.longitude}`}
            />
          )}
        />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  linhaTema: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  lista: {
    marginTop: 12,
  },
});