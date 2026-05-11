import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Determine if identifier is email or phone (simple check for @)
      const isEmail = identifier.includes("@");
      const payload = isEmail ? { email: identifier, password } : { phone: identifier, password };

      const { data } = await axios.post(`${API}/api/auth/login`, payload);
      localStorage.setItem("user", JSON.stringify(data));
      localStorage.setItem("token", data.token);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h2>Welcome Back</h2>
          <p>Login to your account</p>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Phone Number or Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
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
          <button type="submit" className="btn-primary">Login</button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
