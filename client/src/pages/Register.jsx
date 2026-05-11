import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/api/auth/register`, {
        name,
        email,
        phone,
        password,
      });
      localStorage.setItem("user", JSON.stringify(data));
      localStorage.setItem("token", data.token);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h2>Create Account</h2>
          <p>Sign up to get started</p>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="email"
              placeholder="Email Address (Optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Phone Number (Required)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary">Register</button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
