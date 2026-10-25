package com.pag.app.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class StudentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private String json(String cedula, String nombre, String email) {
        return """
                {
                  "cedula": "%s",
                  "nombre": "%s",
                  "email": "%s",
                  "telefono": "0987654321",
                  "direccion": "Av. Principal y Calle 2",
                  "fechaNacimiento": "2000-05-20"
                }
                """.formatted(cedula, nombre, email);
    }

    @Test
    void creaYListaEstudiantes() throws Exception {
        mockMvc.perform(post("/api/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("0101010101", "Ana Pérez", "ana.perez@correo.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.cedula").value("0101010101"));

        mockMvc.perform(get("/api/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.cedula == '0101010101')]").exists());
    }

    @Test
    void rechazaCedulaDuplicada() throws Exception {
        String body = json("0202020202", "Luis Mora", "luis.mora@correo.com");
        mockMvc.perform(post("/api/students")
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("0202020202", "Otro Nombre", "otro.email@correo.com")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void rechazaDatosInvalidos() throws Exception {
        mockMvc.perform(post("/api/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("123", "", "no-es-un-email")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.cedula").exists())
                .andExpect(jsonPath("$.errors.nombre").exists())
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    void actualizaYEliminaEstudiante() throws Exception {
        String response = mockMvc.perform(post("/api/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("0303030303", "Marta Vega", "marta.vega@correo.com")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(response, "$.id");

        mockMvc.perform(put("/api/students/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("0303030303", "Marta Vega Ruiz", "marta.vega@correo.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Marta Vega Ruiz"));

        mockMvc.perform(delete("/api/students/" + id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/students/" + id))
                .andExpect(status().isNotFound());
    }
}
